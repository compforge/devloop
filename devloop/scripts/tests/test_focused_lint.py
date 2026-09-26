#!/usr/bin/env python3
"""LINT_FILES 的项目契约、门禁范围与全量验证隔离。"""
from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import _git, _load_script, run_main, repocli_report
from domain import lifecycle
from domain.context import RepoContext
from domain.lifecycle import checks
from domain.repo_layout import Component


def make_repo(root: str, *, contract: bool = True) -> Path:
    repo = Path(root).resolve()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.name", "Test")
    _git(repo, "config", "user.email", "test@example.com")
    (repo / "pyproject.toml").write_text("[project]\nname = 'lint-fixture'\nversion = '0'\n")
    (repo / ".gitignore").write_text("*.observed\n.devloop/\n")
    (repo / "a.py").write_text("NEEDS_FIX\n")
    (repo / "legacy.py").write_text("BAD\n")
    (repo / "check.py").write_text(
        "import sys\nfrom pathlib import Path\n"
        "action, *files = sys.argv[1:]\n"
        "Path(action + '.observed').write_text(' '.join(files))\n"
        "for name in files:\n"
        "    path = Path(name)\n"
        "    if action == 'fix':\n"
        "        path.write_text(path.read_text().replace('NEEDS_FIX', 'OK'))\n"
        "    elif path.read_text() != 'OK\\n':\n"
        "        raise SystemExit(1)\n"
    )
    selection = "$(if $(strip $(LINT_FILES)),$(LINT_FILES),a.py legacy.py)" if contract else "a.py legacy.py"
    (repo / "Makefile").write_text(
        f"FILES = {selection}\n"
        "fix:\n\t@python3 check.py fix $(FILES)\n"
        "lint-ci: lint\n"
        "lint:\n\t@python3 check.py lint $(FILES)\n"
    )
    _git(repo, "add", "a.py", "legacy.py", "check.py", "Makefile", "pyproject.toml", ".gitignore")
    _git(repo, "commit", "-qm", "baseline")
    return repo


@repocli_report(sources=["a.py"])
def test_focused_gate_preserves_unrelated_files_and_does_not_stamp():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        result = lifecycle.dispatch("pre_commit", str(repo), paths=["a.py"], names=["lint"])
        assert result.proceed, result.results
        assert "focused 1 selected file" in result.results[0].summary
        assert (repo / "fix.observed").read_text() == "a.py"
        assert (repo / "lint.observed").read_text() == "a.py"
        assert (repo / "a.py").read_text() == "OK\n"
        assert (repo / "legacy.py").read_text() == "BAD\n"
        context = RepoContext.load(str(repo))
        assert context is None or not context.validation.component(".").last_lint_at

        # Selected-file errors remain a hard gate, even though baseline errors are outside the scope.
        (repo / "a.py").write_text("BAD\n")
        failed = lifecycle.dispatch("pre_commit", str(repo), paths=["a.py"], names=["lint"])
        assert not failed.proceed


def test_without_contract_runs_full_lint_and_reports_adoption_guidance():
    with TemporaryDirectory() as root:
        repo = make_repo(root, contract=False)
        result = lifecycle.dispatch("pre_commit", str(repo), paths=["a.py"], names=["lint"])
        assert not result.proceed
        assert (repo / "lint.observed").read_text() == "a.py legacy.py"
        assert "未消费 LINT_FILES" in result.results[0].guidance[0]


def test_full_lint_clears_inherited_selection_and_stamps_only_full_success():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "a.py").write_text("OK\n")
        with patch.dict(os.environ, {"LINT_FILES": "a.py"}):
            result = checks.lint(str(repo))
            assert not result.ok
            assert (repo / "lint.observed").read_text() == "a.py legacy.py"
        (repo / "legacy.py").write_text("OK\n")
        assert checks.lint(str(repo)).ok
        context = RepoContext.load(str(repo))
        assert context.validation.component(".").last_lint_at


def test_complete_validate_keeps_full_scope_with_a_dirty_tree():
    from domain import repo as repo_model

    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "a.py").write_text("OK\n")
        component = Component.at(repo, repo)
        results = checks.validate_components(str(repo), repo_model.WorkSet((component,), "full validation"), full=True)
        lint = next(result for result in results if result.name == "lint")
        assert not lint.ok
        assert (repo / "fix.observed").read_text() == "a.py legacy.py"
        assert (repo / "lint.observed").read_text() == "a.py legacy.py"


def test_deleted_and_unrepresentable_paths_fall_back_to_full_lint():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        component = Component.at(repo, repo)
        for paths in (["a.py", "removed.py"], ["a.py", "has space.py"]):
            if "has space.py" in paths:
                (repo / "has space.py").write_text("OK\n")
            result = checks.lint(str(repo), component=component, paths=list(paths))
            assert not result.ok
            assert (repo / "lint.observed").read_text() == "a.py legacy.py"
        for name in ("$(shell touch injected).py", "a;touch injected.py", "-options.py", "a\nb.py"):
            assert component.focused_lint_command([name]) is None
        assert not (repo / "injected").exists()


def test_component_paths_are_relative_and_empty_scope_selects_no_components():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "backend").mkdir()
        (repo / "backend/a.py").write_text("OK\n")
        component = Component.at(repo / "backend", repo)
        assert checks._changed_lint_files(str(repo), component, ["a.py", "backend/a.py"]) == ["a.py"]
        assert checks.lint(str(repo), paths=[]).ok
        assert not (repo / "lint.observed").exists()


@repocli_report(sources=["a.py"])
def test_manual_lint_and_commit_freeze_changed_scope_and_full_is_explicit():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        # Keep the Makefile/runner tracked and only modify the selected source.
        (repo / "a.py").write_text("OK\n")
        runner = _load_script("run_lint")
        with patch.object(checks, "normalize", wraps=checks.normalize) as normalize, \
                patch.object(checks, "lint", wraps=checks.lint) as lint:
            assert runner.main(["--repo", str(repo)]) == 0
            assert normalize.call_args.kwargs["paths"] == ["a.py"]
            assert lint.call_args.kwargs["paths"] == ["a.py"]
            assert runner.main(["--repo", str(repo), "--full"]) == 1
            assert normalize.call_args.kwargs["paths"] is None
            assert lint.call_args.kwargs["paths"] is None

        flow = _load_script("commit_flow")
        # Commit flow must freeze even the implicit scope before normalize can touch the working tree.
        from types import SimpleNamespace
        intent = SimpleNamespace(repo=str(repo), files=["a.py"])
        assert flow.phase_paths(intent, "pre_commit") == ["a.py"]
        intent.files = []
        assert "a.py" in flow.phase_paths(intent, "pre_commit")


if __name__ == "__main__":
    run_main(globals())

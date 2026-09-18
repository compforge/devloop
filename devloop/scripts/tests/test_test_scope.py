#!/usr/bin/env python3
"""Test selection, full-suite accounting and pre-execution scope feedback."""
from __future__ import annotations

import io
import os
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import _git, _load_script, run_main, repocli_report
from domain.context import RepoContext
from domain.lifecycle import checks
from domain.repo_layout import Component
from domain.validation import build_plan
from domain.repo import WorkSet


def make_repo(root: str, *, contract: bool = True) -> Path:
    repo = Path(root).resolve()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.name", "Test")
    _git(repo, "config", "user.email", "test@example.com")
    (repo / "pyproject.toml").write_text("[project]\nname = 'scope-fixture'\nversion = '0'\n")
    (repo / ".gitignore").write_text("*.observed\n.devloop/\n")
    (repo / "source.py").write_text("VALUE = 1\n")
    for name in ("test_a.py", "test_b.py"):
        (repo / name).write_text("OK\n")
    (repo / "check.py").write_text(
        "import sys\nfrom pathlib import Path\n"
        "Path('test.observed').write_text(' '.join(sys.argv[1:]))\n"
        "raise SystemExit(any(Path(name).read_text().strip() != 'OK' for name in sys.argv[1:]))\n"
    )
    selected = "$(if $(strip $(TEST_FILES)),$(TEST_FILES),test_a.py test_b.py)" if contract else "test_a.py test_b.py"
    (repo / "Makefile").write_text(f"SELECTED = {selected}\ntest:\n\t@python3 check.py $(SELECTED)\n")
    _git(repo, "add", "pyproject.toml", ".gitignore", "source.py", "test_a.py", "test_b.py", "check.py", "Makefile")
    _git(repo, "commit", "-qm", "baseline")
    return repo


def has_full_stamp(repo: Path) -> bool:
    ctx = RepoContext.load(str(repo))
    return bool(ctx and ctx.validation.component(".").last_test_at)


def run_check(repo: Path, *, paths=None, extra=None):
    output = io.StringIO()
    with redirect_stdout(output):
        result = checks.test(str(repo), component=Component.at(repo, repo), paths=paths, extra=extra)
    return result, output.getvalue()


@repocli_report(sources=["source.py"], tests=["test_a.py"])
def test_auto_scope_is_visible_before_preparation_and_does_not_stamp():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "test_b.py").write_text("BAD\n")
        output = io.StringIO()
        original = checks._environment_failure

        def prepare(*args, **kwargs):
            text = output.getvalue()
            assert "scope=focused" in text and "TEST_FILES=test_a.py" in text
            assert "repocli file dependencies" in text
            assert not (repo / "test.observed").exists()
            return original(*args, **kwargs)

        with redirect_stdout(output), patch.object(checks, "_environment_failure", side_effect=prepare):
            unit = Component.at(repo, repo)
            plan = build_plan(str(repo), WorkSet((unit,), "fixture"))
            result = checks.test(str(repo), component=unit, plan=plan)
        assert result.ok, result.summary
        assert (repo / "test.observed").read_text() == "test_a.py"
        assert not has_full_stamp(repo)


def test_explicit_related_files_override_automatic_changed_tests():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        result, output = run_check(repo, paths=["test_a.py"], extra=["TEST_FILES=test_a.py test_b.py"])
        assert result.ok, result.summary
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        assert "scope=explicit" in output and "caller supplied" in output
        assert not has_full_stamp(repo)


def test_empty_test_files_runs_and_stamps_full_suite():
    for value in ("TEST_FILES=", "TEST_FILES=   "):
        with TemporaryDirectory() as root:
            repo = make_repo(root)
            with patch.dict(os.environ, {"TEST_FILES": "test_a.py"}):
                result, output = run_check(repo, paths=["test_a.py"], extra=[value])
            assert result.ok, result.summary
            assert "scope=full" in output and "empty TEST_FILES" in output
            assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
            assert has_full_stamp(repo)


def test_full_fallback_clears_inherited_selection_and_explains_scope():
    for paths, reason in ((None, "full Component validation"), (["source.py"], "full Component validation")):
        with TemporaryDirectory() as root:
            repo = make_repo(root)
            (repo / "test_b.py").write_text("BAD\n")
            with patch.dict(os.environ, {"TEST_FILES": "test_a.py"}):
                result, output = run_check(repo, paths=paths)
            assert not result.ok
            assert "scope=full" in output and reason in output
            assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
            assert not has_full_stamp(repo)


def test_explicit_arguments_and_missing_contract_do_not_overclaim_full_coverage():
    for contract, extra in ((True, ["TEST_FILES=", "TEST_FILTER=some_case"]), (False, ["TEST_FILES="])):
        with TemporaryDirectory() as root:
            repo = make_repo(root, contract=contract)
            result, output = run_check(repo, extra=extra)
            assert result.ok
            assert "scope=explicit" in output
            assert not has_full_stamp(repo)
    with TemporaryDirectory() as root:
        repo = make_repo(root, contract=False)
        result, output = run_check(repo, paths=["test_a.py"])
        assert result.ok
        assert "full Component validation" in output
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        assert has_full_stamp(repo)


@repocli_report(sources=["test_a.py"], tests=["test_a.py"])
def test_manual_full_overrides_changed_tests_and_rejects_conflicting_arguments():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "test_a.py").write_text("OK\n\n")
        runner = _load_script("run_tests")
        with redirect_stdout(io.StringIO()):
            assert runner.main([str(repo)]) == 0
        assert (repo / "test.observed").read_text() == "test_a.py"
        assert not has_full_stamp(repo)
        with redirect_stdout(io.StringIO()), patch.dict(os.environ, {"TEST_FILES": "test_a.py"}):
            assert runner.main([str(repo), "--full"]) == 0
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        assert has_full_stamp(repo)
        with patch.object(runner.cli, "resolve_repo_or_exit") as resolve, redirect_stderr(io.StringIO()):
            try:
                runner.main([str(repo), "--full", "--", "TEST_FILES=test_a.py"])
            except SystemExit as exc:
                assert exc.code == 2
            else:
                raise AssertionError("conflicting scope must be rejected")
            resolve.assert_not_called()


if __name__ == "__main__":
    run_main(globals())

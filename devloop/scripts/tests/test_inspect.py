#!/usr/bin/env python3
"""Inspect owns organization; devloop projects it to execution targets."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import os
import subprocess

from _testkit import repocli_report, run_main
from domain import repo as repo_model
from domain.repo_layout import inspect_catalog
from domain.lifecycle.base import DispatchResult, HookResult, dispatch
from domain.validation import content_identity
from lib import repocli
from test_test_scope import make_repo

def native_components(root):
    for name, marker, contents in (("service", "go.mod", "module api\n"), ("client", "package.json", '{"devDependencies":{"typescript":"*"}}')):
        directory = root / name
        directory.mkdir()
        (directory / marker).write_text(contents)


def test_catalog_is_authoritative_and_one_inspection_serves_many_paths():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        native_components(root)
        corpus = root / "service/testdata/corpus"
        corpus.mkdir(parents=True)
        (root / "service/go.mod").write_text("module api\n")
        (corpus / "go.mod").write_text("module fixture\n")
        with patch.object(repocli.toolkit, "inspect", wraps=repocli.toolkit.inspect) as read:
            with patch.object(repocli, "owner", wraps=repocli.owner) as query:
                catalog = inspect_catalog(root)
                selected = repo_model.select_components(root, paths=["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog=catalog)
                assert [c.id for c in selected.components] == ["service", "client"]
                assert catalog.owner(root / "service/deleted.go").name == "service"
                assert catalog.owner(root / "service2/a.go").id == "."
                assert catalog.owner(root.parent / "outside") is None
                assert catalog.owner(root / "service/../../outside") is None
                assert catalog.owner(corpus / "go.mod").id == "service"
                api = catalog.owner(root / "service/deleted.go")
                assert api.language == "go"
                assert api.package_tools[0].evidence == ("service/go.mod",)
                assert query.call_count > 1
                assert read.call_count == 1
        # A new operation observes metadata again, not a process-wide cache.
        (root / "pyproject.toml").unlink()
        (root / "Makefile").unlink()
        (root / "service/go.mod").unlink()
        assert [c.id for c in inspect_catalog(root).components] == ["client"]


def test_makefile_only_and_empty_repository_validation():
    from domain.lifecycle import checks
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        (root / "pyproject.toml").unlink()
        (root / "Makefile").write_text("fix lint test:\n\t@true\n")
        component = inspect_catalog(root).components[0]
        assert component.language is None
        assert component.lint_target() == "lint" and component.test_command() == ("make", "test")
        with repocli_report():
            result = dispatch("pre_commit", str(root), paths=["source.py"], names=["lint", "test"])
        assert result.proceed
        (root / "Makefile").unlink()
        with patch.object(checks, "_make", side_effect=AssertionError("empty catalog ran make")), patch.object(repocli, "read_report", side_effect=AssertionError("empty catalog ran impact")):
            result = dispatch("pre_commit", str(root), paths=["source.py"], names=["lint", "test"])
        assert result.proceed and all(row.status == "skipped" for row in result.results)
        assert all("no recognized Components" in row.summary for row in result.results)
        assert not repo_model.select_components(root).components


def test_makefile_target_headers_are_static_and_support_multiple_targets():
    from domain.repo_layout import Component
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        component = Component.at(root, root)
        (root / "Makefile").write_text("# lint:\nlint := value\nrecipe:\n\t test: false\n")
        assert not component.has_target("lint") and not component.has_target("test")
        (root / "Makefile").write_text("fix lint \\\n test: dependency\n\t@true\nlint-ci::\n\t@true\n")
        assert component.has_target("fix") and component.has_target("test")
        assert component.lint_target() == "lint-ci"


def test_incomplete_observation_and_git_failures_are_unavailable():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        report = repocli.toolkit.inspect(root)
        with patch.object(repocli.toolkit, "inspect", return_value=replace(report, complete=False)):
            result = dispatch("pre_commit", str(root), names=["lint", "test"])
            assert not result.proceed
        for failure in (TimeoutError("deadline"), subprocess.CalledProcessError(1, ["git"])):
            with patch.object(repocli.toolkit, "inspect", side_effect=failure):
                try:
                    inspect_catalog(root)
                    raise AssertionError("fabricated component")
                except repocli.InspectionError as exc:
                    assert exc.__cause__ is failure


def test_execution_containment_rejects_symlinked_component_roots():
    with TemporaryDirectory() as tmp, TemporaryDirectory() as outside:
        root = make_repo(tmp)
        (root / "escape").symlink_to(outside, target_is_directory=True)
        report = repocli.toolkit.inspect(root)
        binding = replace(report.components[0], root="escape/missing")
        with patch.object(repocli.toolkit, "inspect", return_value=replace(report, components=(binding,))):
            try:
                inspect_catalog(root)
                raise AssertionError("accepted escaping component")
            except repocli.InspectionError as exc:
                assert "escapes checkout" in str(exc)


def test_snapshot_is_native_and_separate_from_organization():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        with patch.object(repocli, "read_report", side_effect=AssertionError("CLI called")):
            first = content_identity(str(root))
            assert first.digest.startswith("sha256:")
            (root / "source.py").write_text("changed")
            assert content_identity(str(root)).digest != first.digest


def test_organization_works_without_repocli_binary():
    with TemporaryDirectory() as tmp, patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
        root = make_repo(tmp)
        selected = repo_model.select_components(root)
        assert len(selected.components) == 1 and selected.components[0].language == "python"
        assert content_identity(str(root)).digest


def test_manifest_language_is_retained_without_makefile():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        (root / "go.mod").write_text("module example.invalid/service\n")
        (root / "pyproject.toml").unlink()
        component = inspect_catalog(root).components[0]
        assert component.language == "go"
        (root / "Makefile").unlink()
        assert component.test_command() is None


def test_missing_component_lint_entry_is_unavailable():
    from domain.lifecycle import checks
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        component = inspect_catalog(root).components[0]
        result = checks.lint(str(root), component=component)
        assert result.ok and result.status == "unavailable"
        assert result.guidance
        assert DispatchResult("pre_commit", [result]).proceed
        from domain.context import RepoContext
        context = RepoContext.load(str(root))
        assert context is None or not context.validation.component(component.id).last_lint_at


def test_missing_test_entry_is_nonblocking_without_running_or_stamping():
    from domain.context import RepoContext
    from domain.lifecycle import checks
    for language in ("python", "go"):
        with TemporaryDirectory() as tmp:
            root = make_repo(tmp)
            (root / "Makefile").unlink()
            if language == "go":
                (root / "go.mod").write_text("module example.invalid/service\n")
                (root / "pyproject.toml").unlink()
            component = inspect_catalog(root).components[0]
            with patch.object(checks, "_environment_failure", side_effect=AssertionError("must not prepare a missing command")):
                result = checks.test(str(root), component=component)
            assert result.ok and result.status == "unavailable"
            assert result.guidance
            assert DispatchResult("pre_commit", [result]).proceed
            context = RepoContext.load(str(root))
            assert context is None or not context.validation.component(component.id).last_test_at


def test_missing_lint_does_not_hide_another_components_failed_lint():
    from domain.lifecycle import checks
    missing = HookResult("lint", ok=True, status="unavailable", summary="missing entry")
    passed = HookResult("lint", ok=True, summary="passed")
    failed = HookResult("lint", ok=False, summary="lint command failed")
    available = checks._aggregate("lint", "two components", [missing, passed])
    assert available.status == "unavailable"
    assert DispatchResult("pre_commit", [available]).proceed
    blocked = checks._aggregate("lint", "two components", [missing, failed])
    assert blocked.status == "failed"
    assert not DispatchResult("pre_commit", [blocked]).proceed


if __name__ == "__main__":
    run_main(globals())

#!/usr/bin/env python3
"""Inspect owns organization; devloop projects it to execution targets."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import json
import os
import subprocess

from _testkit import repocli_report, run_main
from domain import repo as repo_model
from domain.repo_layout import inspect_catalog
from domain.lifecycle.base import DispatchResult, HookResult, dispatch
from domain.validation import content_identity
from lib import repocli
from test_test_scope import make_repo

CATALOG = [
    {"root": ".", "name": "workspace"},
    {"root": "service", "name": "api", "language": "go"},
    {"root": "client", "name": "web", "language": "typescript"},
]


def declare(root, components):
    (root / ".repocli.json").write_text(json.dumps({"components": components}))


def test_catalog_is_authoritative_and_one_inspection_serves_many_paths():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        declare(root, CATALOG)
        corpus = root / "service/testdata/corpus"
        corpus.mkdir(parents=True)
        (root / "service/go.mod").write_text("module api\n")
        (corpus / "go.mod").write_text("module fixture\n")
        with patch.object(repocli.toolkit, "inspect", wraps=repocli.toolkit.inspect) as read:
            with patch.object(repocli, "owner", wraps=repocli.owner) as query:
                catalog = inspect_catalog(root)
                selected = repo_model.select_components(root, paths=["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog=catalog)
                assert [c.id for c in selected.components] == ["service", "client"]
                assert catalog.owner(root / "service/deleted.go").name == "api"
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
        declare(root, [{"root": "client", "name": "only"}])
        assert [c.id for c in inspect_catalog(root).components] == ["client"]


def test_invalid_configuration_stops_validation():
    variants = ["{", '{"components":[{"root":"../escape","name":"bad"}]}',
                '{"components":[{"root":".","name":"x"},{"root":".","name":"y"}]}']
    for value in variants:
        with TemporaryDirectory() as tmp:
            root = make_repo(tmp)
            (root / ".repocli.json").write_text(value)
            try:
                inspect_catalog(root)
                raise AssertionError("invalid inspection was accepted")
            except repocli.InspectionError:
                pass
            result = dispatch("pre_commit", str(root), paths=["source.py"], names=["lint", "test"])
            assert not result.proceed
            assert all(not row.ok for row in result.results)


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
        declare(root, [{"root": "escape/missing", "name": "bad"}])
        try:
            inspect_catalog(root)
            raise AssertionError("accepted escaping component")
        except repocli.InspectionError as exc:
            assert "escapes checkout" in str(exc)
        declare(root, [{"root": "missing/inside", "name": "valid"}])
        assert inspect_catalog(root).components[0].id == "missing/inside"


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


def test_declared_go_component_is_not_reclassified_by_python_manifest():
    from lib import ecosystem
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        (root / "go.mod").write_text("module example.invalid/service\n")
        declare(root, [{"root": ".", "name": "service", "language": "go"}])
        component = inspect_catalog(root).components[0]
        assert ecosystem.detect(component.path, component.language).name == "go"
        (root / "Makefile").unlink()
        assert component.test_command() == ("go", "test", "./...")


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

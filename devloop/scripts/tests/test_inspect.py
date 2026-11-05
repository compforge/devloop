#!/usr/bin/env python3
"""Inspect owns organization; devloop projects it to execution targets."""
from dataclasses import replace
from tempfile import TemporaryDirectory
from unittest.mock import patch
import os
import subprocess

from _testkit import run_main
from domain.repo_layout import inspect_catalog
from lib import repokit
from _repo_fixture import make_repo

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
        with patch.object(repokit.toolkit, "inspect", wraps=repokit.toolkit.inspect) as read:
            with patch.object(repokit, "owner", wraps=repokit.owner) as query:
                catalog = inspect_catalog(root)
                assert catalog.owner(root / "service/deleted.go").name == "service"
                assert catalog.owner(root / "service2/a.go").id == "."
                assert catalog.owner(root.parent / "outside") is None
                assert catalog.owner(root / "service/../../outside") is None
                assert catalog.owner(corpus / "go.mod").id == "service"
                api = catalog.owner(root / "service/deleted.go")
                assert api.language == "go"
                assert catalog.owner(root / "client/new.ts").depot.bins[0].path == "client/node_modules"
                assert api.tool_evidence[api.tools[0].name] == ("service/go.mod",)
                assert query.call_count > 1
                assert read.call_count == 1
        # A new operation observes metadata again, not a process-wide cache.
        (root / "pyproject.toml").unlink()
        (root / "Makefile").unlink()
        (root / "service/go.mod").unlink()
        assert [c.id for c in inspect_catalog(root).components] == ["client"]


def test_makefile_only_and_empty_repository_organization():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        (root / "pyproject.toml").unlink()
        (root / "Makefile").write_text("fix lint test:\n\t@true\n")
        assert inspect_catalog(root).components[0].language is None
        (root / "Makefile").unlink()
        assert not inspect_catalog(root).components


def test_incomplete_observation_and_git_failures_are_unavailable():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        report = repokit.toolkit.inspect(root)
        with patch.object(repokit.toolkit, "inspect", return_value=replace(report, complete=False)):
            try:
                inspect_catalog(root)
                raise AssertionError("incomplete observation accepted")
            except repokit.InspectionError:
                pass
        for failure in (TimeoutError("deadline"), subprocess.CalledProcessError(1, ["git"])):
            with patch.object(repokit.toolkit, "inspect", side_effect=failure):
                try:
                    inspect_catalog(root)
                    raise AssertionError("fabricated component")
                except repokit.InspectionError as exc:
                    assert exc.__cause__ is failure


def test_execution_containment_rejects_symlinked_component_roots():
    with TemporaryDirectory() as tmp, TemporaryDirectory() as outside:
        root = make_repo(tmp)
        (root / "escape").symlink_to(outside, target_is_directory=True)
        report = repokit.toolkit.inspect(root)
        binding = replace(report.components[0], root="escape/missing")
        with patch.object(repokit.toolkit, "inspect", return_value=replace(report, components=(binding,))):
            try:
                inspect_catalog(root)
                raise AssertionError("accepted escaping component")
            except repokit.InspectionError as exc:
                assert "escapes checkout" in str(exc)


def test_snapshot_is_native_and_separate_from_organization():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        with patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
            first = repokit.toolkit.snapshot(root)
            assert first.digest.startswith("sha256:")
            (root / "source.py").write_text("changed")
            assert repokit.toolkit.snapshot(root).digest != first.digest


def test_organization_works_without_repocli_binary():
    with TemporaryDirectory() as tmp, patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
        root = make_repo(tmp)
        selected = inspect_catalog(root)
        assert len(selected.components) == 1 and selected.components[0].language == "python"
        assert repokit.toolkit.snapshot(root).digest


def test_manifest_language_is_retained_without_makefile():
    with TemporaryDirectory() as tmp:
        root = make_repo(tmp)
        (root / "go.mod").write_text("module example.invalid/service\n")
        (root / "pyproject.toml").unlink()
        component = inspect_catalog(root).components[0]
        assert component.language == "go"
        (root / "Makefile").unlink()
        assert inspect_catalog(root).components[0].language == "go"


if __name__ == "__main__":
    run_main(globals())

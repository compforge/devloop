#!/usr/bin/env python3
"""Inspect owns organization; devloop projects it to execution targets."""
from tempfile import TemporaryDirectory
from unittest.mock import patch
import os

from _testkit import repocli_report, run_main
from domain import repo as repo_model
from domain.repo_layout import inspect_catalog
from domain.lifecycle.base import dispatch
from domain.validation import content_identity
from lib import repocli
from test_test_scope import make_repo

CATALOG = [
    {"root": ".", "name": "workspace"},
    {"root": "service", "name": "api", "language": "go", "packageTools": [{"name": "go", "evidence": ["service/go.mod"]}]},
    {"root": "client", "name": "web", "language": "typescript"},
]


def test_catalog_is_authoritative_and_one_inspection_serves_many_paths():
    with TemporaryDirectory() as tmp, repocli_report(components=CATALOG):
        root = make_repo(tmp)
        corpus = root / "service/testdata/corpus"
        corpus.mkdir(parents=True)
        (corpus / "go.mod").write_text("module fixture\n")
        with patch.object(repocli, "read_report", wraps=repocli.read_report) as read:
            catalog = inspect_catalog(root)
            selected = repo_model.select_components(root, paths=["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog=catalog)
            assert [c.id for c in selected.components] == ["service", "client"]
            assert catalog.owner(root / "service/deleted.go").name == "api"
            assert catalog.owner(root / "service2/a.go").id == "."
            assert catalog.owner(root.parent / "outside") is None
            assert catalog.owner(corpus / "go.mod").id == "service"
            assert catalog.components[1].language == "go"
            assert catalog.components[1].package_tools[0].evidence == ("service/go.mod",)
            assert read.call_count == 1
        # A new operation reloads the catalog, rather than retaining a process cache.
        with repocli_report(components=[{"root": "client", "name": "only"}]):
            assert [c.id for c in inspect_catalog(root).components] == ["client"]


def test_invalid_inspection_fails_closed():
    variants = [
        "data.update(schemaVersion=2)", "data.update(complete=False)",
        "data.update(input='commit')", "data.update(checkout='/elsewhere')",
        "data.update(components=[{'root':'../escape','name':'bad'}])",
        "data.update(components=[{'root':'.','name':'x'},{'root':'.','name':'y'}])",
    ]
    for mutation in variants:
        with TemporaryDirectory() as tmp, repocli_report(components=CATALOG) as cli:
            root = make_repo(tmp)
            # Preserve a real CLI boundary, then corrupt only the inspect response.
            cli.write_text("#!/usr/bin/env python3\nimport json,sys\ndata=" + repr(dict(schemaVersion=1, checkout=str(root), input="working_tree", complete=True, diagnostics=[], components=CATALOG)) + "\n" + mutation + "\nprint(json.dumps(data))\n")
            try:
                inspect_catalog(root)
                raise AssertionError("invalid inspection was accepted")
            except repocli.InspectionError:
                pass
            result = dispatch("pre_commit", str(root), paths=["source.py"], names=["lint", "test"])
            assert not result.proceed
            assert all(not row.ok for row in result.results)


def test_snapshot_schema_two_is_separate_from_organization():
    with TemporaryDirectory() as tmp, repocli_report() as cli:
        root = make_repo(tmp)
        assert content_identity(str(root)).digest.startswith("sha256:")
        cli.write_text(cli.read_text().replace("schemaVersion=2)", "schemaVersion=1)"))
        identity = content_identity(str(root))
        assert not identity.digest and "requires 2" in identity.problem


def test_missing_inspect_does_not_construct_root_component():
    with TemporaryDirectory() as tmp, patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
        root = make_repo(tmp)
        try:
            repo_model.select_components(root)
            raise AssertionError("fabricated root component")
        except repocli.InspectionError as exc:
            assert "0.11.0" in str(exc)


if __name__ == "__main__":
    run_main(globals())

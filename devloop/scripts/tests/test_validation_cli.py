"""Workflow contracts at the repocli CLI boundary. Real Make contracts live in repokit."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import subprocess

from _testkit import run_main
from _validation_fixture import make_repo, report, has_full_stamp
from domain.validation import run_validation, Comparison
from domain.validation_evidence import full_evidence, evidence_segment
from domain.lifecycle.base import dispatch
from domain.context.store import branch_segment, load_segment, save_segment
from lib import repokit, dependencies


def test_lifecycle_has_no_validation_handlers():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        from domain.lifecycle.base import resolve_handler
        assert all(resolve_handler(name) is None for name in ("format", "lint", "test"))
        with patch.object(repokit, "validation_report") as invoke:
            result = dispatch("pre_commit", str(repo), names=[])
        assert result.proceed and not result.results
        invoke.assert_not_called()


def test_unavailable_test_does_not_block_lint_but_inconsistency_does():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        for consistent in (True, False):
            with patch.object(repokit, "validation_report", return_value=report(repo, test="unavailable", consistent=consistent)):
                outcome = run_validation(str(repo), full=True)
            assert outcome.results[0].ok == consistent
            assert outcome.results[1].status == ("unavailable" if consistent else "failed")
        assert not has_full_stamp(repo)


def test_focused_success_never_promotes_full_evidence():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(repokit, "validation_report", return_value=report(repo, scope="focused")):
            assert all(item.ok for item in run_validation(str(repo), full=True).results)
        assert not has_full_stamp(repo)


def test_cli_owns_history_while_workflow_supplies_dependency_receipts():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(repokit, "validation_report", return_value=report(repo)):
            run_validation(str(repo), full=True)
        def invoke(root, args):
            assert "--reuse" not in args
            inputs = json.loads(Path(args[args.index("--inputs") + 1]).read_text())
            assert inputs["."]["lint"]["disableReuse"] is True
            result = report(repo)
            return result
        with patch.object(repokit, "validation_report", side_effect=invoke), patch.object(dependencies, "reuse_inputs", return_value=None):
            run_validation(str(repo), full=True)


def test_preparation_failure_and_invalid_protocol_never_fall_back_to_make():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(dependencies, "preparation_problem", return_value="install failed"), patch.object(repokit, "validation_report") as invoke:
            try:
                run_validation(str(repo), full=True)
                raise AssertionError("preparation failure ignored")
            except ValueError as error:
                assert "install failed" in str(error)
            invoke.assert_not_called()
        with patch.object(repokit, "validation_report", side_effect=ValueError("unsupported schema")):
            try:
                run_validation(str(repo), full=True)
                raise AssertionError("invalid protocol ignored")
            except ValueError as error:
                assert "unsupported schema" in str(error)


def test_cli_exit_one_report_is_preserved_and_wrong_checkout_rejected():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        data = report(repo, test="failed")
        with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 1, json.dumps(data), "check failed")):
            assert repokit.validation_report(str(repo), []) == data
        data["checkout"] = "/another-checkout"
        with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(data), "")):
            try:
                repokit.validation_report(str(repo), [])
                raise AssertionError("accepted wrong checkout")
            except ValueError as error:
                assert "checkout mismatch" in str(error)


def test_replaced_report_invalidates_branch_reference():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(repokit, "validation_report", return_value=report(repo)):
            run_validation(str(repo), full=True)
        reference = load_segment(str(repo), branch_segment("main", "lint"))["."]
        assert full_evidence(str(repo), ".", "lint", reference)
        record = load_segment(str(repo), evidence_segment(str(repo), ".", "lint"))
        record["eligible"] = False
        save_segment(str(repo), evidence_segment(str(repo), ".", "lint"), record)
        assert full_evidence(str(repo), ".", "lint", reference) is None


def test_empty_diff_skips_cli_and_full_request_does_not():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(repokit, "validation_report", return_value=report(repo)) as invoke:
            assert all(item.status == "skipped" for item in run_validation(str(repo), paths=[]).results)
            assert invoke.call_count == 0
            run_validation(str(repo), paths=[], full=True)
            assert invoke.call_count == 1



def test_shared_evidence_contract():
    fixture = Path(__file__).resolve().parents[2] / "tests/fixtures/validation-evidence.json"
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        for case in json.loads(fixture.read_text())["cases"]:
            data = report(repo)
            data["components"][0]["checks"][0].update(case.get("result", {}))
            data.update(case.get("report", {}))
            record = {"report": data, "eligible": True, "checked_at": "2026-11-01T12:00:00Z"}
            record.update(case.get("record", {}))
            segment = evidence_segment(str(repo), ".", "lint")
            save_segment(str(repo), segment, record)
            reference = {"evidence": segment, "checked_at": "2026-11-01T12:00:00Z", **case.get("reference", {})}
            assert bool(full_evidence(str(repo), ".", "lint", reference)) == case["valid"], case["name"]


def test_initial_history_uses_full_selection_and_skips_preserve_evidence():
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        with patch.object(repokit, "validation_report", return_value=report(repo)) as invoke, patch("lib.git_state.target_exists", return_value=False):
            run_validation(str(repo))
            assert "--base" not in invoke.call_args.args[1]
        original = load_segment(str(repo), evidence_segment(str(repo), ".", "lint"))
        data = report(repo, lint="skipped", test="skipped")
        for check in data["components"][0]["checks"]:
            check["scope"] = "skipped"
        with patch.object(repokit, "validation_report", return_value=data):
            run_validation(str(repo), full=True)
        assert load_segment(str(repo), evidence_segment(str(repo), ".", "lint")) == original



def test_root_fallback_accepts_partial_groups_and_binds_requested_component():
    from types import SimpleNamespace
    from domain.validation_evidence import full_projection
    from domain.validation import _record, Comparison
    with TemporaryDirectory() as tmp:
        repo = make_repo(tmp)
        (repo / "child").mkdir()
        value = report(repo)
        lint, test = value["components"][0]["checks"]
        lint["requestedComponents"] = ["child"]
        test["requestedComponents"] = ["child"]
        value["components"] = [
            {"component": {"root": "."}, "checks": [lint]},
            {"component": {"root": "child"}, "checks": [test]},
        ]
        with patch.object(repokit.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=json.dumps(value), stderr="")):
            decoded = repokit.validation_report(str(repo), ["--check", "format,lint,test"])
        _record(str(repo), decoded, True, Comparison())
        from lib.git_state import get_current_branch
        assert "child" in full_projection(str(repo), get_current_branch(repo), "lint")
        assert "child" in full_projection(str(repo), get_current_branch(repo), "test")



if __name__ == "__main__":
    run_main(globals())

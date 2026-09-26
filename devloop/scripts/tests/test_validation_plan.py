#!/usr/bin/env python3
"""Repocli consumption: one plan, full fallback, cross-component tests and phases."""
from __future__ import annotations

import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from _testkit import _git_out, _git, _load_script, repocli_report, run_main
from test_test_scope import make_repo, has_full_stamp
from domain import repo as repo_model
from domain.context.store import load_segment, branch_segment
from domain.lifecycle import checks
from domain.lifecycle.base import dispatch, DispatchResult
from domain.validation import Comparison, build_plan


def test_one_analysis_after_fix_shared_by_lint_and_tests():
    with TemporaryDirectory() as root, repocli_report(sources=["source.py"], tests=["test_a.py"]):
        repo = make_repo(root)
        with (repo / "Makefile").open("a") as f:
            f.write("fix:\n\t@echo normalized >> fix.observed\nlint:\n\t@echo '$(LINT_FILES)' > lint.observed\n")
        with redirect_stdout(io.StringIO()):
            result = dispatch("pre_commit", str(repo), paths=["source.py"], names=["lint", "test"])
        assert result.proceed and all(r.ok for r in result.results)
        assert (repo / "fix.observed").read_text().splitlines() == ["normalized"]
        assert len((repo / "analysis.observed").read_text().splitlines()) == 1
        assert (repo / "lint.observed").read_text().strip() == "source.py"
        assert (repo / "test.observed").read_text() == "test_a.py"
        assert not has_full_stamp(repo)


def test_missing_cli_runs_full_and_publishes_reason():
    with TemporaryDirectory() as root, patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
        repo = make_repo(root)
        (repo / "source.py").write_text("VALUE = 2\n")
        runner = _load_script("run_tests")
        with redirect_stdout(io.StringIO()):
            assert runner.main([str(repo)]) == 0
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        state = load_segment(repo, branch_segment("main", "validation_scope"))
        assert state and all(row["scope"] == "full" for row in state["checks"])
        assert "repocli fallback" in state["checks"][0]["reason"]
        assert not has_full_stamp(repo)
        assert state["identity_problem"]


def test_invalid_and_failed_cli_reports_fall_back():
    outputs = ['not JSON', '{"schemaVersion":1}',
               json.dumps({"schemaVersion":3,"complete":False,"diagnostics":[{"code":"snapshot_changed"}]}),
               json.dumps({"schemaVersion":3,"complete":True,"scope":"focused"})]
    for output in outputs:
        with TemporaryDirectory() as root, repocli_report() as cli:
            repo = make_repo(root)
            cli.write_text("#!/usr/bin/env python3\nprint("+repr(output)+")\n")
            plan = build_plan(str(repo), repo_model.select_components(repo))
            assert all(not selection.files for selection in plan.selections.values())
            assert "repocli fallback" in plan.workset.reason
    with TemporaryDirectory() as root, repocli_report() as cli:
        repo = make_repo(root)
        cli.write_text("#!/usr/bin/env python3\nraise SystemExit(7)\n")
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert "exited 7" in plan.workset.reason



def test_partial_analysis_runs_returned_tests_and_keeps_diagnostics():
    for status in ({"complete": False, "scope": "partial"},
                   {"diagnostics": [{"code": "unresolved_import"}]}):
        with TemporaryDirectory() as root, repocli_report(
                sources=["source.py"], tests=["test_a.py"], **status):
            repo = make_repo(root)
            (repo / "test_b.py").write_text("BAD\n")
            runner = _load_script("run_tests")
            with redirect_stdout(io.StringIO()):
                assert runner.main([str(repo)]) == 0
            assert (repo / "test.observed").read_text() == "test_a.py"
            assert not has_full_stamp(repo)
            state = load_segment(repo, branch_segment("main", "validation_scope"))
            row = state["checks"][0]
            assert row["scope"] == "focused" and row["files"] == ["test_a.py"]
            assert "partial analysis" in row["reason"] and "fallback" not in row["reason"]
            if status.get("diagnostics"):
                assert "unresolved_import" in row["reason"]


def test_successful_empty_test_list_skips_without_preparation_or_stamp():
    for sources in ([], ["source.py"]):
        for complete, scope in ((True, "focused"), (False, "partial")):
            with TemporaryDirectory() as root, repocli_report(sources=sources, complete=complete, scope=scope):
                repo = make_repo(root)
                (repo / "source.py").write_text("VALUE=2\n")
                plan = build_plan(str(repo), repo_model.select_components(repo), checks=("test",))
                with patch.object(checks, "_environment_failure") as prepare:
                    result = checks.test_components(str(repo), plan.workset, plan=plan)
                assert result.ok and "skipped" in result.summary
                prepare.assert_not_called()
                assert not (repo / "test.observed").exists()
                assert not has_full_stamp(repo)
                state = load_segment(repo, branch_segment("main", "validation_scope"))
                assert state["checks"][0]["scope"] == "skipped"


def test_partial_analysis_does_not_relax_lint_or_project_contract():
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], complete=False, scope="partial"):
        repo = make_repo(root, contract=False)
        with (repo / "Makefile").open("a") as f:
            f.write("lint:\n\t@echo $(LINT_FILES)\n")
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert plan.selections[(".", "lint")].scope == "full"
        assert "analysis incomplete" in plan.selections[(".", "lint")].reason
        assert plan.selections[(".", "test")].scope == "full"
        result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert result.ok
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"


def test_cli_failure_executes_full_tests():
    with TemporaryDirectory() as root, repocli_report() as cli:
        repo = make_repo(root)
        cli.write_text(cli.read_text().replace("if sys.argv[1]=='diff':", "if sys.argv[1]=='diff': raise SystemExit(7)\nif sys.argv[1]=='diff':"))
        plan = build_plan(str(repo), repo_model.select_components(repo), checks=("test",))
        assert "exited 7" in plan.workset.reason
        result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert result.ok
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"

def test_test_failure_does_not_retry_or_stamp():
    with TemporaryDirectory() as root, repocli_report(sources=["source.py"], tests=["test_b.py"]):
        repo = make_repo(root)
        (repo / "test_b.py").write_text("BAD\n")
        with redirect_stdout(io.StringIO()):
            result = checks.validate_components(str(repo), repo_model.select_components(repo), names=("test",))
        assert any(not r.ok for r in result)
        assert len((repo / "analysis.observed").read_text().splitlines()) == 1
        assert (repo / "test.observed").read_text() == "test_b.py"
        assert not has_full_stamp(repo)


def test_dependent_component_added_and_explicit_boundary_preserved():
    with TemporaryDirectory() as root, repocli_report(sources=["lib/source.py"], tests=["app/test_use.py"]):
        repo = make_repo(root)
        for name in ("lib", "app"):
            component = repo/name
            component.mkdir()
            (component/"pyproject.toml").write_text("[project]\nname='"+name+"'\nversion='0'\n")
            (component/"Makefile").write_text("lint:\n\t@echo $(LINT_FILES)\ntest:\n\t@echo $(TEST_FILES)\n")
        (repo/"lib/source.py").write_text("VALUE=2\n")
        (repo/"app/test_use.py").write_text("from lib.source import VALUE\n")
        ws = repo_model.select_components(repo, explicit=repo/"lib")
        plan = build_plan(str(repo), ws, paths=["lib/source.py"])
        assert {u.id for u in plan.workset.components} == {"lib", "app"}
        assert plan.selections[("app", "test")].files == ("test_use.py",)
        assert plan.selections[("lib", "test")].scope == "skipped"
        explicit = build_plan(str(repo), ws, explicit=True)
        assert [u.id for u in explicit.workset.components] == ["lib"]


def test_phase_comparison_reaches_dispatch():
    flow = _load_script("commit_flow")
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        intent = SimpleNamespace(repo=str(repo), target="main", files=["source.py"])
        for phase, base, head in (("pre_commit", "HEAD", ""), ("post_commit", "HEAD^", "HEAD"),
                                  ("pre_mr", _git_out(repo,"rev-parse","HEAD").strip(), "HEAD")):
            with patch.object(flow.lifecycle, "dispatch", return_value=DispatchResult(phase, [])) as call:
                flow.run_lifecycle_gate(intent, phase, [])
                assert call.call_args.kwargs["comparison"] == Comparison(base, head)


def test_committed_report_with_dirty_execution_uses_full_scope():
    with TemporaryDirectory() as root, repocli_report(sources=["source.py"], tests=["test_a.py"]):
        repo = make_repo(root)
        (repo/"source.py").write_text("VALUE=5\n")
        plan = build_plan(str(repo), repo_model.select_components(repo), comparison=Comparison("HEAD^", "HEAD"))
        assert "differs from committed" in plan.workset.reason
        assert not (repo/"analysis.observed").exists()


def test_timeout_falls_back_and_full_bypasses_cli():
    import subprocess
    from domain import validation
    original = subprocess.run
    def run(argv, *args, **kwargs):
        if len(argv) > 1 and argv[1] == "diff":
            raise subprocess.TimeoutExpired(argv, 35)
        return original(argv, *args, **kwargs)
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        with patch.object(validation.subprocess, "run", side_effect=run):
            plan = build_plan(str(repo), repo_model.select_components(repo))
        assert "timed out" in plan.workset.reason
        with repocli_report(sources=["source.py"], tests=["test_a.py"]):
            full = build_plan(str(repo), repo_model.select_components(repo), full=True)
        assert not (repo/"analysis.observed").exists()
        assert all(s.scope == "full" for s in full.selections.values())


def test_edit_after_planning_invalidates_selection_without_executing_checks():
    with TemporaryDirectory() as root, repocli_report(sources=["source.py"], tests=["test_a.py"]):
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo))
        (repo/"source.py").write_text("VALUE=99\n")
        result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert not result.ok
        assert "contents changed" in result.summary
        assert not (repo/"test.observed").exists()
        assert not has_full_stamp(repo)


def test_snapshot_protocol_failures_never_authorize_stamps():
    from domain.validation import content_identity
    for updates in ({"complete": False, "diagnostics": [{"code": "snapshot_incomplete", "message": "child not initialized"}]},
                    {"input": "commit"}, {"snapshot": "sha256:" + "z" * 64}, {"schemaVersion": 99}):
        with TemporaryDirectory() as root, repocli_report() as cli:
            repo = make_repo(root)
            script = cli.read_text().replace("if sys.argv[1]=='snapshot': data.update(schemaVersion=1)",
                                            "if sys.argv[1]=='snapshot': data.update(schemaVersion=1); data.update(" + repr(updates) + ")")
            cli.write_text(script)
            identity = content_identity(str(repo))
            assert not identity.digest and identity.problem
            with redirect_stdout(io.StringIO()):
                plan = build_plan(str(repo), repo_model.select_components(repo), full=True)
                result = checks.test_components(str(repo), plan.workset, plan=plan)
            assert result.ok and "not stamped" in result.summary
            assert not has_full_stamp(repo)
            assert plan.identity_problem


def test_full_check_can_stamp_captured_symlink_inputs():
    with TemporaryDirectory() as root, repocli_report():
        repo = make_repo(root)
        (repo / "AGENTS.md").write_text("instructions")
        (repo / "CLAUDE.md").symlink_to("AGENTS.md")
        with redirect_stdout(io.StringIO()):
            plan = build_plan(str(repo), repo_model.select_components(repo), full=True)
            result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert plan.execution_identity and not plan.identity_problem
        assert result.ok and has_full_stamp(repo), result.summary


def test_snapshot_failure_after_planning_is_not_reported_as_an_edit():
    with TemporaryDirectory() as root, repocli_report():
        repo = make_repo(root)
        with redirect_stdout(io.StringIO()):
            plan = build_plan(str(repo), repo_model.select_components(repo), full=True)
            with patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
                result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert not result.ok
        assert "cannot verify contents" in result.summary
        assert "contents changed" not in result.summary
        assert not (repo / "test.observed").exists()


def test_check_failure_and_selection_reason_are_separate():
    from domain.lifecycle.base import HookResult
    result = checks._aggregate("test", "repocli fallback: analysis incomplete",
                              [HookResult("test", ok=False, summary="make test failed after 1s")])
    assert result.summary == "make test failed after 1s"
    assert "selection: repocli fallback: analysis incomplete" in result.guidance
    assert not result.ok


def test_schema3_local_outline_gap_keeps_focused_checks():
    # +spec=`Local extraction observations do not trigger full validation`
    observation = {"reason": "outline_incomplete", "subject": "declarations",
                   "path": "unchanged.py", "version": "after", "scope": "document",
                   "outline": {"omittedNameConflict": 2}, "disposition": "local_gap"}
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], observations=[observation]):
        repo = make_repo(root)
        with (repo / "Makefile").open("a") as f:
            f.write("fix:\n\t@echo '$(LINT_FILES)' > fix.observed\nlint:\n\t@echo '$(LINT_FILES)' > lint.observed\n")
        (repo / "test_b.py").write_text("BAD\n")
        with redirect_stdout(io.StringIO()):
            result = dispatch("pre_commit", str(repo), paths=["source.py"], names=["lint", "test"])
        assert result.proceed and all(r.ok for r in result.results)
        assert (repo / "lint.observed").read_text().strip() == "source.py"
        assert (repo / "test.observed").read_text() == "test_a.py"
        invocations = (repo / "analysis.observed").read_text().splitlines()
        assert len(invocations) == 1
        argv = json.loads(invocations[0])
        assert "--impact" not in argv
        assert argv[argv.index("--test-dir") + 1] == "."
        state = load_segment(repo, branch_segment("main", "validation_scope"))
        assert all(row["scope"] == "focused" for row in state["checks"])
        assert not has_full_stamp(repo)


def test_schema2_diff_falls_back_with_upgrade_guidance():
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], schema=2):
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert "requires 3" in plan.workset.reason
        assert "repocli >= 0.5.0" in plan.workset.reason
        assert all(selection.scope == "full" for selection in plan.selections.values())
        assert plan.execution_identity and not plan.identity_problem  # Snapshot schema remains 1.


if __name__ == "__main__":
    run_main(globals())

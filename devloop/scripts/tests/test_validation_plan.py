#!/usr/bin/env python3
"""Repocli consumption: one plan, full fallback, cross-component tests and phases."""
from __future__ import annotations

import io
import json
import os
from contextlib import redirect_stdout
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
        assert (repo / "lint.observed").read_text().strip() == ""
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        assert has_full_stamp(repo)


def test_invalid_inspect_stops_validation_without_fabricated_component():
    with TemporaryDirectory() as root, patch.dict(os.environ, {"DEVLOOP_REPOCLI": "/missing/repocli"}):
        repo = make_repo(root)
        (repo / "package.json").symlink_to("source.py")
        runner = _load_script("run_tests")
        assert runner.main([str(repo)]) == 1
        assert not (repo / "test.observed").exists()
        assert not has_full_stamp(repo)


def test_invalid_and_failed_cli_reports_fall_back():
    outputs = ['not JSON', '{"schemaVersion":1}',
               json.dumps({"schemaVersion":3,"complete":False,"diagnostics":[{"code":"snapshot_changed"}]}),
               json.dumps({"schemaVersion":3,"complete":True,"scope":"focused"})]
    for output in outputs:
        with TemporaryDirectory() as root, repocli_report() as cli:
            repo = make_repo(root)
            cli.write_text(cli.read_text().replace("if sys.argv[1]=='impact':", "if sys.argv[1]=='impact': print("+repr(output)+"); raise SystemExit(0)\nif sys.argv[1]=='impact':"))
            plan = build_plan(str(repo), repo_model.select_components(repo))
            assert all(not selection.files for selection in plan.selections.values())
            assert "repocli fallback" in plan.workset.reason
    with TemporaryDirectory() as root, repocli_report() as cli:
        repo = make_repo(root)
        cli.write_text(cli.read_text().replace("if sys.argv[1]=='impact':", "if sys.argv[1]=='impact': raise SystemExit(7)\nif sys.argv[1]=='impact':"))
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert "exited 7" in plan.workset.reason



def test_partial_analysis_runs_full_component_and_keeps_diagnostics():
    for status in ({"complete": False, "scope": "partial"},
                   {"diagnostics": [{"code": "unresolved_import"}]}):
        with TemporaryDirectory() as root, repocli_report(sources=["source.py"], tests=["test_a.py"], **status):
            repo = make_repo(root)
            (repo / "test_b.py").write_text("BAD\n")
            runner = _load_script("run_tests")
            with redirect_stdout(io.StringIO()):
                assert runner.main([str(repo)]) == 1
            assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
            assert not has_full_stamp(repo)
            row = load_segment(repo, branch_segment("main", "validation_scope"))["checks"][0]
            assert row["scope"] == "full" and row["files"] == []
            assert "partial analysis" in row["reason"] and "fallback" not in row["reason"]
            if status.get("diagnostics"):
                assert "unresolved_import" in row["reason"]


def test_affected_component_without_discovered_tests_runs_full_suite():
    with TemporaryDirectory() as root, repocli_report(sources=["source.py"]):
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo), checks=("test",))
        result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert result.ok and has_full_stamp(repo)
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"


def test_partial_analysis_runs_canonical_targets_without_file_list_contract():
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], complete=False, scope="partial"):
        repo = make_repo(root, contract=False)
        with (repo / "Makefile").open("a") as f:
            f.write("lint:\n\t@echo canonical lint\n")
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert plan.selections[(".", "lint")].scope == "full"
        assert "partial analysis" in plan.selections[(".", "lint")].reason
        assert plan.selections[(".", "test")].scope == "full"
        result = checks.test_components(str(repo), plan.workset, plan=plan)
        assert result.ok
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"


def test_cli_failure_executes_full_tests():
    with TemporaryDirectory() as root, repocli_report() as cli:
        repo = make_repo(root)
        cli.write_text(cli.read_text().replace("if sys.argv[1]=='impact':", "if sys.argv[1]=='impact': raise SystemExit(7)\nif sys.argv[1]=='impact':"))
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
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
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
        assert plan.selections[("app", "test")].scope == "full"
        assert plan.selections[("lib", "test")].scope == "full"
        explicit = build_plan(str(repo), ws, explicit=True)
        assert [u.id for u in explicit.workset.components] == ["lib"]


def test_component_facts_select_downstream_and_local_unknown_without_path_remapping():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        names = ("lib", "app", "unknown", "unrelated")
        (repo / "pyproject.toml").unlink()
        (repo / "Makefile").unlink()
        for name in names:
            unit = repo / name
            unit.mkdir()
            (unit / "Makefile").write_text(
                "lint:\n\t@echo full > lint.observed\ntest:\n\t@echo full > test.observed\n")
        impacts = [dict(root=name, snapshot="after", component={"name": name},
                        affected=name in ("lib", "app"), complete=name != "unknown",
                        fallbackReasons=["configuration effect unknown"] if name == "unknown" else [])
                   for name in names]
        # No file lists: Components are the authoritative selection, including a
        # downstream source-only Component and one independently uncertain Component.
        with repocli_report(components=impacts, complete=False, scope="partial"):
            ws = repo_model.select_components(repo, explicit=repo / "lib")
            plan = build_plan(str(repo), ws, paths=["lib/config.json"])
        assert {unit.id for unit in plan.workset.components} == {"lib", "app", "unknown"}
        assert all(selection.scope == "full" for selection in plan.selections.values())
        assert "unknown Component impact" in plan.selections[("unknown", "lint")].reason
        assert "configuration effect unknown" in plan.selections[("unknown", "lint")].reason
        with patch.object(checks, "_environment_failure", return_value=None):
            assert checks.lint_components(str(repo), plan.workset, plan=plan).ok
            assert checks.test_components(str(repo), plan.workset, plan=plan).ok
        for name in ("lib", "app", "unknown"):
            assert (repo / name / "lint.observed").read_text().strip() == "full"
            assert (repo / name / "test.observed").read_text().strip() == "full"
        assert not (repo / "unrelated/lint.observed").exists()


def test_complete_unaffected_components_skip_without_preparation_or_stamps():
    with TemporaryDirectory() as root, repocli_report():
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert not plan.workset.components and not plan.selections
        with patch.object(checks, "_environment_failure") as prepare, patch.object(checks, "_make") as make:
            assert checks.lint_components(str(repo), plan.workset, plan=plan).status == "skipped"
            assert checks.test_components(str(repo), plan.workset, plan=plan).status == "skipped"
        prepare.assert_not_called()
        make.assert_not_called()
        assert not has_full_stamp(repo)


def test_unknown_impact_is_not_an_empty_success():
    with TemporaryDirectory() as root, repocli_report(complete=False, scope="partial"):
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert len(plan.workset.components) == 1
        assert all(selection.scope == "full" for selection in plan.selections.values())
        assert "unknown Component impact" in plan.selections[(".", "test")].reason


def test_missing_or_invalid_affected_files_are_not_an_empty_result():
    for affected in (None, {}, [{}], [{"path": "../outside.py"}]):
        with TemporaryDirectory() as root, repocli_report() as cli:
            repo = make_repo(root)
            cli.write_text(cli.read_text().replace("print(json.dumps(data))",
                "if sys.argv[1]=='impact': data['affectedFiles']=" + repr(affected) + "\nprint(json.dumps(data))"))
            plan = build_plan(str(repo), repo_model.select_components(repo))
            assert "repocli fallback" in plan.workset.reason
            assert all(s.scope == "full" for s in plan.selections.values())


def test_missing_stale_or_invalid_component_reports_fall_back():
    from domain.repo_layout import inspect_catalog
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        name = inspect_catalog(repo).components[0].name
        valid = dict(root=".", snapshot="after", component={"name": name}, affected=False, complete=True)
        for invalid in (None, [], [{k: v for k, v in valid.items() if k != "affected"}],
                        [dict(valid, complete="unknown")], [dict(valid, root="../outside")],
                        [dict(valid, component={"name": "stale"})], [valid, valid]):
            with repocli_report() as cli:
                cli.write_text(cli.read_text().replace("print(json.dumps(data))",
                    "data['components']=" + repr(invalid) + "\nprint(json.dumps(data))"))
                plan = build_plan(str(repo), repo_model.select_components(repo))
            assert "repocli fallback" in plan.workset.reason, invalid
            assert all(selection.scope == "full" for selection in plan.selections.values())


def test_before_only_component_is_evidence_not_an_execution_directory():
    from domain.repo_layout import inspect_catalog
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        name = inspect_catalog(repo).components[0].name
        impacts = [dict(root=".", snapshot="after", component={"name": name}, affected=False, complete=True),
                   dict(root="removed", snapshot="before", component={"name": "removed"}, affected=True, complete=True)]
        with repocli_report(components=impacts):
            plan = build_plan(str(repo), repo_model.select_components(repo))
        assert not plan.workset.components
        assert list(plan.component_impacts) == impacts
        with repocli_report(components=impacts):
            explicit = build_plan(str(repo), repo_model.select_components(repo), explicit=True)
        assert [unit.id for unit in explicit.workset.components] == ["."]
        assert all(selection.scope == "full" for selection in explicit.selections.values())


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


@repocli_report()
def test_timeout_falls_back_and_full_bypasses_cli():
    import subprocess
    from domain import validation
    original = subprocess.run
    def run(argv, *args, **kwargs):
        if len(argv) > 1 and argv[1] == "impact":
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


def test_native_snapshot_failures_never_authorize_stamps():
    from domain.validation import content_identity
    from repocli import Snapshot
    with TemporaryDirectory() as root, repocli_report():
        repo = make_repo(root)
        unavailable = Snapshot(str(repo), "sha256:" + "a" * 64, 0, False, ("child not initialized",))
        with patch("domain.validation.snapshot", return_value=unavailable):
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
            with patch("domain.validation.snapshot", side_effect=OSError("capture unavailable")):
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


def test_local_outline_observations_keep_component_selection():
    # +spec=`Local extraction observations do not expand Component selection`
    observation = {"reason": "outline_incomplete", "subject": "declarations",
                   "path": "unchanged.py", "version": "after", "scope": "document",
                   "outline": {"omittedNameConflict": 2}, "disposition": "local_gap"}
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], observations=[observation]):
        repo = make_repo(root)
        with (repo / "Makefile").open("a") as f:
            f.write("fix:\n\t@echo '$(LINT_FILES)' > fix.observed\nlint:\n\t@echo '$(LINT_FILES)' > lint.observed\n")
        with redirect_stdout(io.StringIO()):
            result = dispatch("pre_commit", str(repo), paths=["source.py"], names=["lint", "test"])
        assert result.proceed and all(r.ok for r in result.results)
        assert (repo / "lint.observed").read_text().strip() == ""
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        invocations = (repo / "analysis.observed").read_text().splitlines()
        assert len(invocations) == 1
        argv = json.loads(invocations[0])
        assert "--impact" not in argv
        assert "--test-dir" not in argv
        state = load_segment(repo, branch_segment("main", "validation_scope"))
        assert all(row["scope"] == "full" for row in state["checks"])
        assert has_full_stamp(repo)


def test_schema2_diff_falls_back_with_upgrade_guidance():
    with TemporaryDirectory() as root, repocli_report(
            sources=["source.py"], tests=["test_a.py"], schema=2):
        repo = make_repo(root)
        plan = build_plan(str(repo), repo_model.select_components(repo))
        assert "requires 3" in plan.workset.reason
        assert "repocli >= 0.24.0" in plan.workset.reason
        assert all(selection.scope == "full" for selection in plan.selections.values())
        assert plan.execution_identity and not plan.identity_problem  # Snapshot schema remains 1.



def test_parent_component_does_not_receive_child_owned_files():
    with TemporaryDirectory() as root, repocli_report(
            affected=["child/source.py"], tests=["child/test_a.py"]):
        repo = make_repo(root)
        child = repo / "child"
        child.mkdir()
        (child / "source.py").write_text("VALUE=1\n")
        (child / "test_a.py").write_text("OK\n")
        (child / "Makefile").write_text("test:\n\t@echo $(TEST_FILES)\nlint:\n\t@echo $(LINT_FILES)\n")
        plan = build_plan(str(repo), repo_model.select_components(repo, paths=["source.py", "child/source.py"]))
        assert {unit.id for unit in plan.workset.components} == {"child"}
        assert all(selection.scope == "full" for selection in plan.selections.values())





def test_repository_without_markers_stays_unowned():
    from domain.repo_layout import inspect_catalog
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "pyproject.toml").unlink()
        (repo / "Makefile").unlink()
        catalog = inspect_catalog(str(repo))
        assert not catalog.components
        assert catalog.owner(repo / "source.py") is None


def test_checkout_discovery_failure_is_not_absence():
    from domain.repo_layout import find_git_root
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / ".git" / "HEAD").write_text("broken")
        try:
            find_git_root(repo)
        except OSError:
            pass
        else:
            raise AssertionError("corrupt checkout treated as absent")


def test_plan_recording_preserves_identity_on_branch_lookup_failure():
    from domain import validation
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        old = validation.Plan(repo_model.WorkSet((), "previous"), execution_identity="previous")
        validation.persist_plan(str(repo), old)
        previous = load_segment(repo, branch_segment("main", "validation_scope"))
        _git(repo, "checkout", "--detach", "-q")
        validation.persist_plan(str(repo), old)
        detached = load_segment(repo, branch_segment(None, "validation_scope"))
        assert detached["execution_identity"] == "previous"
        _git(repo, "checkout", "-q", "main")
        output = io.StringIO()
        with patch.object(validation.git_state, "get_current_branch", side_effect=OSError("branch read failed")), redirect_stdout(output):
            validation.persist_plan(str(repo), validation.Plan(repo_model.WorkSet((), "new"), execution_identity="new"))
        assert "validation scope not recorded: branch read failed" in output.getvalue()
        assert load_segment(repo, branch_segment("main", "validation_scope")) == previous
        assert load_segment(repo, branch_segment(None, "validation_scope")) == detached


if __name__ == "__main__":
    run_main(globals())

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
        assert has_full_stamp(repo)


def test_invalid_uncertain_and_failed_cli_reports_fall_back():
    outputs = ['not JSON', '{"schemaVersion":1}',
               json.dumps({"schemaVersion":2,"complete":False,"diagnostics":[{"code":"snapshot_changed"}]}),
               json.dumps({"schemaVersion":2,"complete":True,"scope":"focused","impactMode":"file"})]
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
        if "--impact" in argv:
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


if __name__ == "__main__":
    run_main(globals())

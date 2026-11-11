"""Depot CLI results drive workflow warnings; devloop never rediscovers package tools."""
import json
import subprocess
from unittest.mock import patch

from _testkit import run_main
from domain import worktree


def result(bins=(), *, outcome="succeeded", complete=True, **overrides):
    data = {"checkout": "/repo", "complete": complete, "bins": list(bins)}
    return subprocess.CompletedProcess([], 0 if outcome == "succeeded" else 1, json.dumps({
        "schemaVersion": "1.0", "command": "repocli depot prepare", "outcome": outcome,
        "data": data, "cost": {"wallSeconds": 2},
        "error": None if outcome == "succeeded" else {"code": "depot.prepare_incomplete", "message": "incomplete"},
        **overrides,
    }), "")


def test_one_cli_call_handles_all_components_and_shared_bins():
    bins = [
        {"path": "node_modules", "status": "ready", "action": "prepared", "components": [".", "apps/web"]},
        {"path": "api/.venv", "status": "ready", "action": "reused"},
    ]
    with patch.object(worktree.subprocess, "run", return_value=result(bins)) as run:
        assert worktree.prepare_environment("/repo") == []
    assert run.call_count == 1
    assert run.call_args.args[0] == ["repocli", "depot", "prepare", "--repo", "/repo", "--timeout", "600s", "--json"]
    assert run.call_args.kwargs["timeout"] > 600


def test_present_environment_is_preserved_and_logged_without_claiming_ready():
    with patch.object(worktree.subprocess, "run", return_value=result([
        {"path": "node_modules", "status": "present", "action": "preserved"}
    ])), patch.object(worktree.logger, "warning") as warning:
        assert worktree.prepare_environment("/repo") == []
        assert warning.call_count == 1


def test_failure_preserves_each_bin_reason_and_installer_output():
    bins = [
        {"path": "node_modules", "status": "unknown", "action": "uncertain", "stderr": "registry unavailable", "error": {"message": "install timed out"}},
        {"path": "api/.venv", "status": "missing", "action": "not_run"},
    ]
    with patch.object(worktree.subprocess, "run", return_value=result(bins, outcome="unknown", complete=False)):
        warnings = worktree.prepare_environment("/repo")
    assert len(warnings) == 2
    assert "registry unavailable" in warnings[0] and "install timed out" in warnings[0]
    assert "not_run" in warnings[1]


def test_unsupported_is_a_workflow_warning_not_an_install_fallback():
    with patch.object(worktree.subprocess, "run", return_value=result([
        {"path": "node_modules", "status": "missing", "action": "unsupported", "error": {"message": "no locked installer"}}
    ], outcome="failed")):
        assert "no locked installer" in worktree.prepare_environment("/repo")[0]


def test_missing_timed_out_and_malformed_cli_never_become_success():
    for failure in (FileNotFoundError("repocli"), subprocess.TimeoutExpired("repocli", 610)):
        with patch.object(worktree.subprocess, "run", side_effect=failure):
            assert "unavailable" in worktree.prepare_environment("/repo")[0]
    for output in (subprocess.CompletedProcess([], 0, "not JSON", ""),
                   result(schemaVersion="99"), result(command="repocli inspect"),
                   result(complete=False), result(data={"checkout": "/elsewhere", "complete": True, "bins": []}),
                   result([{"path": "node_modules", "status": "missing", "action": "failed"}])):
        with patch.object(worktree.subprocess, "run", return_value=output):
            assert "unavailable" in worktree.prepare_environment("/repo")[0]


def test_failed_observation_without_bin_results_preserves_top_error():
    with patch.object(worktree.subprocess, "run", return_value=result(outcome="failed", complete=False)):
        assert worktree.prepare_environment("/repo") == ["incomplete"]


if __name__ == "__main__":
    run_main(globals())

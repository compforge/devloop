#!/usr/bin/env python3
"""Rebase development policy and CLI boundary; Git lifecycle cases belong to RepoKit."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from unittest.mock import patch

from _testkit import run_main  # noqa: E402
from domain import rebase  # noqa: E402
from domain.context.gate import GateView  # noqa: E402
from domain.context.base import PullRequest  # noqa: E402
import command  # noqa: E402


def view(branch="feature", state="open", target="main"):
    pr = PullRequest(number=1, state=state, source_branch=branch, target_branch=target)
    return GateView("/repo", branch, "a" * 40, "main", "github", pr)


def response(action, phase_name, **fields):
    data = {"checkout": str(Path("/repo").resolve()), "action": action, "phase": phase_name,
            "confirmed": True, "conflicts": [], "diagnostics": [],
            "transaction": {"branch": "feature", "target": "main", "expectedRemote": "a" * 40,
                            "targetCommit": "b" * 40}, **fields}
    return {"schemaVersion": "1.0", "command": f"repocli git rebase {action}", "outcome": "succeeded", "data": data}


def rejected(operation, text):
    try:
        operation()
    except rebase.RebaseError as error:
        assert text in str(error), str(error)
    else:
        raise AssertionError("expected rejection")


def test_start_delegates_selected_policy_without_local_transaction():
    with (patch.object(rebase.gate, "evaluate", return_value=view()),
          patch.object(rebase.session, "foreign_owner", return_value=None),
          patch.object(rebase, "run_repocli", return_value=response("start", "ready")) as run,
          patch.object(rebase.RepoContext, "refresh_branch") as refresh):
        plan = rebase.start("/repo")
    run.assert_called_once_with("/repo", ("git", "rebase", "start"),
                                ["--branch", "feature", "--target", "main"], timeout=300)
    refresh.assert_called_once_with("/repo")
    assert any("validate" in line for line in plan)


def test_development_policy_rejects_protected_inactive_or_mismatched_target():
    for v, target, message in [(view("main"), None, "protected"),
                               (view(state="merged"), None, "merged or closed"),
                               (view(), "release", "differs")]:
        with (patch.object(rebase.gate, "evaluate", return_value=v),
              patch.object(rebase.session, "foreign_owner", return_value=None),
              patch.object(rebase, "run_repocli") as run):
            rejected(lambda: rebase.start("/repo", target), message)
            run.assert_not_called()


def test_foreign_session_blocks_mutations_but_not_status():
    with (patch.object(rebase.session, "foreign_owner", return_value={"session_id": "other"}),
          patch.object(rebase, "run_repocli", return_value=response("status", "paused")) as run):
        for action in (rebase.start, rebase.continue_rebase, rebase.finish, rebase.abort):
            rejected(lambda: action("/repo"), "another active session")
        run.assert_not_called()
        assert rebase.status("/repo")[0] == "rebase phase=paused"


def test_continue_and_abort_allow_git_detached_state_without_pr_lookup():
    for action, phase, operation in [("continue", "paused", rebase.continue_rebase),
                                     ("abort", "aborted", rebase.abort)]:
        with (patch.object(rebase.session, "foreign_owner", return_value=None),
              patch.object(rebase.gate, "evaluate", side_effect=AssertionError("no PR lookup while detached")),
              patch.object(rebase, "run_repocli", return_value=response(action, phase)),
              patch.object(rebase.RepoContext, "refresh_branch")):
            assert operation("/repo")[0] == f"rebase phase={phase}"


def test_failure_unknown_and_unconfirmed_reports_never_refresh_context():
    for outcome in ("failed", "unknown", "partial"):
        report = response("continue", "paused"); report.update(outcome=outcome, error={"message": "inspect before retry"})
        with (patch.object(rebase.session, "foreign_owner", return_value=None),
              patch.object(rebase, "run_repocli", return_value=report),
              patch.object(rebase.RepoContext, "refresh_branch") as refresh):
            rejected(lambda: rebase.continue_rebase("/repo"), outcome)
            refresh.assert_not_called()
    for fields in ({"checkout": "/elsewhere"}, {"confirmed": False}, {"phase": "published"},
                   {"transaction": None}, {"diagnostics": [None]}):
        with (patch.object(rebase.session, "foreign_owner", return_value=None),
              patch.object(rebase, "run_repocli", return_value=response("continue", "paused", **fields)),
              patch.object(rebase.RepoContext, "refresh_branch") as refresh):
            rejected(lambda: rebase.continue_rebase("/repo"), "unavailable")
            refresh.assert_not_called()


def test_finish_rechecks_policy_and_confirmed_publication_survives_context_warning():
    report = response("finish", "published", diagnostics=[{"message": "record warning"}])
    with (patch.object(rebase.gate, "evaluate", return_value=view()),
          patch.object(rebase.session, "foreign_owner", return_value=None),
          patch.object(rebase, "run_repocli", return_value=report) as run,
          patch.object(rebase.RepoContext, "refresh_branch", side_effect=OSError("metadata unavailable"))):
        plan = rebase.finish("/repo")
    assert run.call_count == 1 and plan[0] == "rebase phase=published"
    assert any("record warning" in s for s in plan) and any("context refresh" in s for s in plan)


def test_protocol_failure_has_no_fallback_and_preserves_recovery_guidance():
    invalid = [subprocess.CompletedProcess([], 0, "not json"),
               subprocess.CompletedProcess([], 0, json.dumps({"schemaVersion": "other"})),
               subprocess.CompletedProcess([], 1, json.dumps(response("status", "ready")))]
    for result in invalid:
        with patch.object(command.subprocess, "run", return_value=result):
            rejected(lambda: rebase.status("/repo"), "inspect repocli git rebase status")
    for error in (FileNotFoundError("repocli"), subprocess.TimeoutExpired("repocli", 310)):
        with patch.object(command.subprocess, "run", side_effect=error):
            rejected(lambda: rebase.status("/repo"), "inspect repocli git rebase status")
    with patch.object(command.subprocess, "run", return_value=subprocess.CompletedProcess(
            [], 0, json.dumps(response("status", "ready")))) as run:
        rebase.status("/repo")
        assert run.call_args.kwargs["timeout"] == 310


if __name__ == "__main__":
    run_main(globals())

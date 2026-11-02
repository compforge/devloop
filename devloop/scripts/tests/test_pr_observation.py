"""Request cost, freshness and destructive-action contracts for PR observation."""
from __future__ import annotations

import fcntl
from pathlib import Path
from unittest.mock import patch

from _testkit import _pr_context, _FakeForge, _git, _git_out, _load_script, run_main
from test_worktree import _fixture, _add_worktree
from domain.context import prstate, store, base, gate
from domain.forge import ForgeError, ForgeRateLimited, PullRequest
from domain import pull_request_lifecycle
from tasks import pr_lifecycle


def test_commit_cli_reports_live_rate_limit_before_any_mutation():
    # +case=`a live quota failure reports its retry time and stops before mutation`
    from contextlib import redirect_stderr
    from io import StringIO

    repo, _, _ = _fixture("commit_quota_observation")
    command = _load_script("commit_flow")
    error = StringIO()
    with patch.object(command.gate, "evaluate", side_effect=ForgeRateLimited("core", 2000000000)), \
         patch.object(command, "prepare_branch") as mutation, redirect_stderr(error):
        assert command.main(["mr", "--repo", repo, "--message", "fix: quota handling"]) == 1
    mutation.assert_not_called()
    assert "PR state verification failed" in error.getvalue()
    assert "retry_at=2000000000" in error.getvalue()










def test_executor_lease_and_cadence_cover_all_triggers():
    repo, _, _ = _fixture("shared_observation_claim")
    home = store.tmp_dir(repo)
    home.mkdir(parents=True, exist_ok=True)
    with (home / "pr-observation.lock").open("w") as claim:
        fcntl.flock(claim, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with patch.object(pr_lifecycle, "_sweep_repo", side_effect=AssertionError("overlap")):
            assert pr_lifecycle.sweep_repo(repo)["skipped"] == "running"
    with patch.object(pr_lifecycle, "_sweep_repo", return_value={"repo": repo}) as sweep:
        pr_lifecycle.sweep_repo(repo)
        assert pr_lifecycle.sweep_repo(repo)["skipped"] == "not_due"
        assert sweep.call_count == 1


def test_local_branch_change_invalidates_idle_cadence():
    repo, _, _ = _fixture("idle_observation_change")
    with patch.object(pr_lifecycle, "_sweep_repo", return_value={"repo": repo}) as sweep:
        pr_lifecycle.sweep_repo(repo)
        assert pr_lifecycle.sweep_repo(repo)["skipped"] == "not_due"
        _git(repo, "branch", "new-work")
        pr_lifecycle.sweep_repo(repo)
        assert sweep.call_count == 2











def test_reused_branch_is_reverified_before_removal():
    repo, _, _ = _fixture("query_reuse")
    target = _add_worktree(repo, "reused")
    head = _git_out(target, "rev-parse", "HEAD")
    fake = _FakeForge([PullRequest(1, state="merged", source_branch="worktree-reused", sha=head)])
    context = _pr_context(repo, fake)
    inventory = context.local_branches()
    from dataclasses import replace
    fake._prs[2] = replace(fake._prs[1], number=2, state="open")
    actions = pull_request_lifecycle.reconcile(repo, context=context, inventory=inventory)
    assert actions[0].status == "deferred" and Path(target).is_dir()
    assert store.load_segment(repo, "pr") is None
    assert store.load_segment(repo, "local_pull_requests") is None


def test_gate_reports_unavailable_and_ambiguous_queries():
    repo, _, _ = _fixture("query_gate")
    fake = _FakeForge([PullRequest(1, state="open", source_branch="main")])
    context = _pr_context(repo, fake)
    with patch.object(prstate, "pr_context_for_repo", return_value=context):
        assert gate.evaluate(repo).in_flight()
    # A new resource lifetime reuses library-owned state, not a .devloop projection.
    context = _pr_context(repo, fake)
    context.observer.now = lambda: 4000000000
    with patch.object(prstate, "pr_context_for_repo", return_value=context), \
         patch.object(fake, "prs_for_branch", side_effect=ForgeError("offline")):
        try:
            gate.evaluate(repo)
        except ForgeError:
            pass
        else:
            raise AssertionError("failed query must not authorize a decision")


def test_query_view_isolates_one_branch_failure():
    repo, _, _ = _fixture("query_isolation")
    _git(repo, "branch", "healthy")
    fake = _FakeForge([PullRequest(1, state="open", source_branch="main"),
                       PullRequest(2, state="open", source_branch="healthy")])
    context = _pr_context(repo, fake)
    get = fake.get
    def read(number):
        if number == 1:
            raise ForgeError("offline")
        return get(number)
    with patch.object(fake, "get", side_effect=read):
        rows = {row.branch: row for row in context.local_branches()}
    assert rows["main"].error
    assert rows["healthy"].selected.number == 2


if __name__ == "__main__":
    run_main(globals())

"""Request cost, freshness and destructive-action contracts for PR observation."""
from __future__ import annotations

import fcntl
from pathlib import Path
from unittest.mock import patch

from _testkit import _FakeForge, _git, _git_out, _load_script, run_main
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


def test_retained_history_does_not_multiply_fast_poll_requests():
    # +case=`250 retained historical branches require one open inventory and no branch queries`
    repo, _, _ = _fixture("bounded_observation")
    head = _git_out(repo, "rev-parse", "HEAD")
    branches = [(f"old-{i}", head) for i in range(250)]
    previous = {"branches": [{"branch": b, "head_sha": head, "checkout": None,
                              "pull_request": None, "checked_at": base.now(),
                              "history_checked_at": base.now()} for b, _ in branches]}
    prstate.persist_local_pull_requests(repo, previous)
    fake = _FakeForge([])
    with patch.object(prstate.git_state, "list_local_branches", return_value=branches), \
         patch.object(fake, "prs_for_branch", side_effect=AssertionError("history reread")), \
         patch.object(fake, "open_pull_requests", wraps=fake.open_pull_requests) as inventory:
        assert len(prstate.poll_local_pull_requests(repo, forge=fake)["branches"]) == 250
        inventory.assert_called_once()


def test_cold_history_is_bounded_and_unknown_entries_are_explicit():
    repo, _, _ = _fixture("cold_observation")
    head = _git_out(repo, "rev-parse", "HEAD")
    branches = [(f"old-{i}", head) for i in range(250)]
    fake = _FakeForge([])
    with patch.object(prstate.git_state, "list_local_branches", return_value=branches), \
         patch.object(fake, "prs_for_branch", wraps=fake.prs_for_branch) as history:
        payload = prstate.poll_local_pull_requests(repo, forge=fake)
        assert history.call_count == prstate.HISTORY_BATCH
        assert sum(r["observation"] == "unknown" for r in payload["branches"]) == 230
        prstate.persist_local_pull_requests(repo, payload)
        history.reset_mock()
        second = prstate.poll_local_pull_requests(repo, forge=fake)
        assert history.call_count == prstate.HISTORY_BATCH
        assert sum(r["observation"] == "unknown" for r in second["branches"]) == 210


def test_disappeared_open_pr_requires_positive_terminal_read():
    repo, _, _ = _fixture("missing_open_observation")
    head = _git_out(repo, "rev-parse", "HEAD")
    pr = PullRequest(1, state="open", source_branch="main", sha=head)
    fake = _FakeForge([pr])
    assert prstate.refresh_local_pull_requests(repo, forge=fake)
    old = store.load_segment(repo, "local_pull_requests")
    with patch.object(fake, "open_pull_requests", return_value=[]), \
         patch.object(fake, "get", side_effect=ForgeError("unavailable")):
        assert not prstate.refresh_local_pull_requests(repo, forge=fake)
    assert store.load_segment(repo, "local_pull_requests") == old


def test_reused_branch_is_not_removed_from_cached_terminal_pr():
    repo, _, _ = _fixture("reused_observation")
    target = _add_worktree(repo, "reused")
    head = _git_out(target, "rev-parse", "HEAD")
    old = PullRequest(1, state="merged", source_branch="worktree-reused", sha=head)
    fake = _FakeForge([old])
    assert prstate.refresh_local_pull_requests(repo, forge=fake)
    fake._prs[2] = PullRequest(2, state="open", source_branch="worktree-reused", sha=head)
    actions = pull_request_lifecycle.reconcile(repo, forge=fake)
    assert actions[0].status == "deferred"
    assert Path(target).is_dir()


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


def test_live_branch_gate_does_not_fetch_comments_or_reuse_failed_observation():
    repo, _, _ = _fixture("live_observation_gate")
    fake = _FakeForge([])
    with patch.object(prstate, "forge_for_repo", return_value=fake), \
         patch.object(fake, "comments", side_effect=AssertionError("auxiliary read")), \
         patch.object(fake, "recent", side_effect=AssertionError("window read")):
        gate.evaluate(repo, live_refresh=True)
        with patch.object(fake, "prs_for_branch", side_effect=ForgeError("offline")):
            try:
                gate.evaluate(repo, live_refresh=True)
            except ForgeError:
                pass
            else:
                raise AssertionError("failed live lookup must not accept cached state")


def test_detail_failure_preserves_its_own_success_time():
    repo, _, _ = _fixture("detail_observation")
    fake = _FakeForge([])
    assert prstate.refresh_pr(repo, forge=fake)
    assert prstate.refresh_pr_details(repo, fake, force=True)
    before = store.load_segment(repo, "pr")
    with patch.object(fake, "recent", side_effect=ForgeError("offline")):
        assert not prstate.refresh_pr_details(repo, fake, force=True)
    assert store.load_segment(repo, "pr") == before


def test_current_projection_keeps_historical_verification_time():
    repo, _, _ = _fixture("historical_current_time")
    inventory = {"branches": [{"branch": "main", "checked_at": 123,
                                "pull_request": None}]}
    payload = prstate.poll_pr(repo, forge=_FakeForge([]), inventory=inventory)
    assert payload["checked_at"] == 123


def test_slow_details_cannot_overwrite_new_core_observation():
    repo, _, _ = _fixture("concurrent_detail_observation")
    fake = _FakeForge([])
    assert prstate.refresh_pr(repo, forge=fake)
    old = store.load_segment(repo, "pr")
    newer = dict(old, checked_at=old["checked_at"] + 1, branch="new-work", pr_number=None)

    def refresh_during_read(limit):
        prstate.persist_pr(repo, newer)
        return []

    with patch.object(fake, "recent", side_effect=refresh_during_read):
        assert prstate.refresh_pr_details(repo, fake, force=True)
    assert store.load_segment(repo, "pr") == newer


if __name__ == "__main__":
    run_main(globals())

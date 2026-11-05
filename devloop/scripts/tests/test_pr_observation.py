"""Request cost, freshness and destructive-action contracts for PR observation."""
from __future__ import annotations

from unittest.mock import patch

from _testkit import _pr_context, _FakeForge, _git, _load_script, run_main
from test_worktree import _fixture
from domain.context import prstate, gate
from domain.forge import ForgeError, ForgeRateLimited, PullRequest


def test_commit_cli_reports_live_rate_limit_before_any_mutation():
    # +case=`a live quota failure reports its retry time and stops before mutation`
    from contextlib import redirect_stderr
    from io import StringIO

    repo, _, _ = _fixture("commit_quota_observation")
    command = _load_script("commit_flow")
    error = StringIO()
    with patch.object(command.gate, "evaluate", side_effect=ForgeRateLimited("core", 2000000000)), \
         patch.object(command, "prepare_branch") as mutation, redirect_stderr(error):
        assert command.main(["push", "--repo", repo, "--message", "fix: quota handling"]) == 1
    mutation.assert_not_called()
    assert "PR state verification failed" in error.getvalue()
    assert "retry_at=2000000000" in error.getvalue()


def test_gate_reports_unavailable_queries():
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


def test_gate_distinguishes_missing_credentials_from_no_forge_origin():
    # +case=`Missing credentials cannot authorize a commit; an absent Forge origin is inapplicable`
    from contextlib import redirect_stderr
    from io import StringIO
    from lib import config
    from domain.forge import ForgeAuthError

    repo, _, _ = _fixture("gate_credentials")
    _git(repo, "switch", "-qc", "feature")
    assert gate.evaluate(repo).active_pr is None  # Local filesystem origin.
    _git(repo, "remote", "set-url", "origin", "https://github.com/example/repo.git")
    command = _load_script("commit_flow")
    with patch.object(config, "forge_token", return_value=None):
        try:
            gate.evaluate(repo)
        except ForgeAuthError as exc:
            assert "no credential for github.com" in str(exc)
        else:
            raise AssertionError("missing credentials must not authorize a gate")
        assert prstate.checkout_pr(repo) == ("", None)  # Presentation remains best-effort.
        with patch.object(command, "prepare_branch") as mutation, redirect_stderr(StringIO()) as error:
            assert command.main(["commit", "--repo", repo, "-m", "blocked"]) == 1
        mutation.assert_not_called()
        assert "no credential" in error.getvalue()


def test_commit_only_rejects_unavailable_and_ambiguous_pr_queries():
    # +case=`Commit-only still requires an unambiguous PR lifecycle observation`
    from contextlib import redirect_stderr
    from io import StringIO

    for failure in ("offline", "ambiguous"):
        repo, _, _ = _fixture(f"commit_query_{failure}")
        _git(repo, "switch", "-qc", "feature")
        fake = _FakeForge([PullRequest(n, state="open", source_branch="feature") for n in (1, 2)])
        if failure == "offline":
            def unavailable(*args, **kwargs):
                raise ForgeError("offline")
            fake.prs_for_branch = unavailable
        context = _pr_context(repo, fake)
        command = _load_script("commit_flow")
        with patch.object(prstate, "pr_context_for_repo", return_value=context), \
             patch.object(command, "prepare_branch") as mutation, redirect_stderr(StringIO()) as error:
            assert command.main(["commit", "--repo", repo, "-m", "blocked"]) == 1
        mutation.assert_not_called()
        expected = "offline" if failure == "offline" else "multiple PRs match"
        assert expected in error.getvalue()


def test_gate_accepts_verified_absence_of_pr():
    repo, _, _ = _fixture("gate_no_pr")
    with patch.object(prstate, "pr_context_for_repo", return_value=_pr_context(repo, _FakeForge([]))):
        assert gate.evaluate(repo).active_pr is None


if __name__ == "__main__":
    run_main(globals())

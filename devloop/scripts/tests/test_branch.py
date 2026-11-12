"""Branch workflow owns policy and projections; Git preservation regressions live in RepoKit."""
from contextlib import ExitStack
from unittest.mock import patch
import subprocess

from _testkit import run_main
from domain import branch
from domain.context.session import SessionIdentity

REPO = "/tmp/devloop-branch-contract"


def report(**updates):
    data = dict(checkout=REPO, branch="topic", currentBranch="topic", phase="restored",
                action="created", diagnostics=[], branchConfirmed=True, changesRestored=True, confirmed=True,
                writeAttempted=True, stashOid="a" * 40, recoveryPath="/tmp/recovery")
    data.update(updates)
    return data


def mocks(stack, envelope=None, error=None, previous=None):
    invoke = stack.enter_context(patch.object(branch, "run_repocli", return_value=envelope, side_effect=error))
    stack.enter_context(patch.object(branch.git_state, "get_current_branch", return_value="main"))
    stack.enter_context(patch.object(branch.session, "read", return_value=previous))
    acquire = stack.enter_context(patch.object(branch.session, "acquire", return_value=True))
    release = stack.enter_context(patch.object(branch.session, "release"))
    refresh = stack.enter_context(patch.object(branch.RepoContext, "refresh_branch"))
    return invoke, acquire, release, refresh


def create(base="origin/main", carry=True):
    return branch.create(REPO, "topic", base, carry_changes=carry, identity=SessionIdentity("codex", "ours"))


def test_branch_maps_policy_to_cli_and_refreshes_confirmed_identity():
    with ExitStack() as stack:
        invoke, acquire, release, refresh = mocks(stack, {"outcome": "succeeded", "data": report()})
        result = create()
        invoke.assert_called_once_with(REPO, ("git", "branch", "create"),
                                       ["topic", "--base", "main", "--remote", "origin", "--carry-changes"], timeout=300)
        assert result.created and result.carried_changes and result.fork_from == "main"
        refresh.return_value.set_fork_from.assert_called_once_with("main")
        assert acquire.call_args.args == (REPO, "ours", "topic")
        release.assert_not_called()


def test_branch_reuse_keeps_fork_policy_and_has_no_new_carry():
    with ExitStack() as stack:
        invoke, _, _, refresh = mocks(stack, {"outcome": "succeeded", "data": report(action="reused", writeAttempted=False)})
        result = create("HEAD", carry=False)
        assert not result.created and not result.carried_changes and result.fork_from is None
        assert invoke.call_args.args[2] == ["topic", "--base", "HEAD"]
        refresh.return_value.set_fork_from.assert_not_called()


# +case=A failed carry still updates the confirmed branch projection, retains owner and surfaces the exact recovery backup.
def test_branch_conflict_updates_context_without_replaying_cli():
    with ExitStack() as stack:
        invoke, acquire, release, refresh = mocks(stack, {"outcome": "failed", "error": {"message": "restore failed"},
            "data": report(phase="conflict", changesRestored=False, confirmed=False)})
        try:
            create()
            assert False
        except branch.BranchError as error:
            assert "restore failed" in str(error) and "a" * 40 in str(error) and "/tmp/recovery" in str(error)
        refresh.return_value.set_fork_from.assert_called_once_with("main")
        assert acquire.call_args.args == (REPO, "ours", "topic")
        release.assert_not_called()
        assert invoke.call_count == 1


def test_unknown_and_malformed_results_preserve_owner_and_never_retry():
    for envelope, error in [
        ({"outcome": "unknown", "data": report(branchConfirmed=False, currentBranch="main", confirmed=False)}, None),
        ({"outcome": "succeeded", "data": report(checkout="/other")}, None),
        ({"outcome": "succeeded", "data": report(confirmed=False)}, None),
        (None, subprocess.TimeoutExpired("repocli", 300)),
    ]:
        with ExitStack() as stack:
            invoke, _, release, _ = mocks(stack, envelope, error)
            try:
                create()
                assert False
            except branch.BranchError:
                pass
            release.assert_not_called()
            assert invoke.call_count == 1


def test_known_rejection_releases_only_new_owner():
    for previous in (None, {"session_id": "ours"}):
        with ExitStack() as stack:
            _, _, release, refresh = mocks(stack, {"outcome": "failed", "data": report(
                branchConfirmed=False, currentBranch="main", writeAttempted=False, phase="none", confirmed=False)}, previous=previous)
            try:
                create()
                assert False
            except branch.BranchError:
                pass
            assert release.call_count == (0 if previous else 1)
            refresh.assert_not_called()


def test_projection_failure_does_not_reclassify_confirmed_git_result():
    with ExitStack() as stack:
        _, acquire, release, refresh = mocks(stack, {"outcome": "succeeded", "data": report()})
        refresh.side_effect = OSError("projection unavailable")
        assert create().created
        assert acquire.call_args.args == (REPO, "ours", "topic")
        release.assert_not_called()


if __name__ == "__main__":
    run_main(globals())

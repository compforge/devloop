#!/usr/bin/env python3
"""Safe rebase transaction: resumability, exact-SHA lease, conflict continuation."""
from __future__ import annotations

import shutil
from pathlib import Path

from _testkit import _git, _git_out, run_main  # noqa: E402  (bootstrap first)
from domain import rebase  # noqa: E402


def _fixture(name: str, *, conflict: bool = False) -> tuple[str, str]:
    root = Path(f"/tmp/dlut_rebase_{name}")
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    remote = root / "remote.git"
    repo = root / "repo"
    remote.mkdir()
    repo.mkdir()
    _git(str(remote), "init", "--bare", "-q")
    _git(str(repo), "init", "-q", "-b", "main")
    _git(str(repo), "config", "user.email", "t@t.t")
    _git(str(repo), "config", "user.name", "t")
    (repo / "shared.txt").write_text("base\n")
    _git(str(repo), "add", "shared.txt")
    _git(str(repo), "commit", "-qm", "base")
    _git(str(repo), "remote", "add", "origin", str(remote))
    _git(str(repo), "push", "-qu", "origin", "main")

    _git(str(repo), "checkout", "-qb", "feat/rebase")
    if conflict:
        (repo / "shared.txt").write_text("feature\n")
        _git(str(repo), "add", "shared.txt")
    else:
        (repo / "feature.txt").write_text("feature\n")
        _git(str(repo), "add", "feature.txt")
    _git(str(repo), "commit", "-qm", "feature")
    _git(str(repo), "push", "-qu", "-u", "origin", "feat/rebase")

    _git(str(repo), "checkout", "-q", "main")
    if conflict:
        (repo / "shared.txt").write_text("target\n")
        _git(str(repo), "add", "shared.txt")
    else:
        (repo / "target.txt").write_text("target\n")
        _git(str(repo), "add", "target.txt")
    _git(str(repo), "commit", "-qm", "target")
    _git(str(repo), "push", "-q", "origin", "main")
    _git(str(repo), "checkout", "-q", "feat/rebase")
    return str(repo), str(remote)


def test_rebase_finish_uses_saved_exact_sha_lease():
    repo, remote = _fixture("finish")
    old_remote = _git_out(remote, "rev-parse", "refs/heads/feat/rebase")

    plan = rebase.start(repo, "main")
    state = rebase.load_state(repo)
    assert state and state.remote_sha == old_remote
    assert any("captured lease" in line for line in plan)
    assert _git_out(repo, "merge-base", "--is-ancestor", "origin/main", "HEAD") == ""

    plan = rebase.finish(repo)
    assert rebase.load_state(repo) is None
    assert _git_out(remote, "rev-parse", "refs/heads/feat/rebase") == _git_out(repo, "rev-parse", "HEAD")
    assert any("only if it was still at" in line for line in plan)


def test_rebase_finish_refuses_intervening_remote_push():
    repo, remote = _fixture("lease_moved")
    rebase.start(repo, "main")
    state = rebase.load_state(repo)
    assert state is not None

    moved = _git_out(remote, "rev-parse", "refs/heads/main")
    _git(remote, "update-ref", "refs/heads/feat/rebase", moved)
    try:
        rebase.finish(repo)
        assert False, "expected the exact-SHA lease preflight to reject a moved remote"
    except rebase.RebaseError as exc:
        assert "moved since start" in str(exc) and "no remote history was overwritten" in str(exc)
    assert _git_out(remote, "rev-parse", "refs/heads/feat/rebase") == moved
    assert rebase.load_state(repo) == state


def test_rebase_conflict_continue_then_finish_without_message():
    repo, remote = _fixture("conflict", conflict=True)
    plan = rebase.start(repo, "main")
    assert rebase.load_state(repo) is not None
    assert any("paused on conflicts" in line for line in plan)

    Path(repo, "shared.txt").write_text("target + feature\n")
    _git(repo, "add", "shared.txt")
    plan = rebase.continue_rebase(repo)
    assert any("is complete" in line for line in plan)
    assert _git_out(repo, "branch", "--show-current") == "feat/rebase"

    rebase.finish(repo)
    assert rebase.load_state(repo) is None
    assert _git_out(remote, "rev-parse", "refs/heads/feat/rebase") == _git_out(repo, "rev-parse", "HEAD")


def test_rebase_abort_restores_branch_and_clears_state():
    repo, _ = _fixture("abort", conflict=True)
    before = _git_out(repo, "rev-parse", "HEAD")
    rebase.start(repo, "main")
    plan = rebase.abort(repo)
    assert rebase.load_state(repo) is None
    assert _git_out(repo, "rev-parse", "HEAD") == before
    assert _git_out(repo, "branch", "--show-current") == "feat/rebase"
    assert any("aborted" in line for line in plan)


def test_uncertain_rebase_retains_transaction_for_inspection():
    from unittest.mock import patch
    from repocli.git import GitResult

    repo, _ = _fixture("uncertain")
    with patch.object(rebase.operations, "rebase", return_value=GitResult(-1, "", "timeout", uncertain=True)):
        try:
            rebase.start(repo, "main")
            assert False, "timeout must not be reported as a known failure"
        except rebase.RebaseError as exc:
            assert "outcome unknown" in str(exc)
    assert rebase.load_state(repo) is not None



def test_linked_rebase_has_independent_transaction_and_abort():
    repo, _ = _fixture("linked", conflict=True)
    _git(repo, "checkout", "-q", "main")
    linked = str(Path(repo).parent / " linked 工作区 ")
    _git(repo, "worktree", "add", "-q", linked, "feat/rebase")
    before = _git_out(linked, "rev-parse", "HEAD")
    rebase.start(linked, "main")
    assert rebase.load_state(linked) is not None
    assert rebase.load_state(repo) is None
    assert rebase.git_state.rebase_in_progress(linked)
    assert not rebase.git_state.rebase_in_progress(repo)
    rebase.abort(linked)
    assert rebase.load_state(linked) is None
    assert _git_out(linked, "rev-parse", "HEAD") == before


def test_continue_and_abort_uncertainty_preserve_lease():
    from unittest.mock import patch
    from repocli.git import GitResult

    repo, _ = _fixture("resume_uncertain", conflict=True)
    rebase.start(repo, "main")
    state = rebase.load_state(repo)
    for method, operation in (("continue_rebase", rebase.continue_rebase), ("abort_rebase", rebase.abort)):
        with patch.object(rebase.operations, method, return_value=GitResult(-1, "", "timeout", uncertain=True)):
            try:
                operation(repo)
                assert False, "an uncertain write must retain the transaction"
            except rebase.RebaseError as exc:
                assert "outcome unknown" in str(exc)
        assert rebase.load_state(repo) == state
    rebase.abort(repo)


def test_rebase_observation_failure_preserves_lease():
    from unittest.mock import patch

    repo, _ = _fixture("observation_failed", conflict=True)
    rebase.start(repo, "main")
    state = rebase.load_state(repo)
    with patch.object(rebase.git_state, "rebase_in_progress", side_effect=OSError("metadata unreadable")):
        for operation in (rebase.continue_rebase, rebase.abort, rebase.finish):
            try:
                operation(repo)
                assert False, "unknown rebase state must stop the workflow"
            except OSError as exc:
                assert "metadata unreadable" in str(exc)
            assert rebase.load_state(repo) == state
    rebase.abort(repo)


if __name__ == "__main__":
    run_main(globals())

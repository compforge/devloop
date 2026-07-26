#!/usr/bin/env python3
"""Managed worktrees start fresh without rewriting intentional resumes."""

from __future__ import annotations

import shutil
from pathlib import Path

from _testkit import _git, _git_out, run_main  # noqa: E402  (bootstrap first)
from domain import worktree  # noqa: E402


def _fixture(name: str) -> tuple[str, str, str]:
    root = Path(f"/tmp/dlut_worktree_{name}")
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    remote = root / "remote.git"
    repo = root / "repo"
    actor = root / "actor"
    remote.mkdir()
    repo.mkdir()

    _git(str(remote), "init", "--bare", "-q")
    _git(str(repo), "init", "-q", "-b", "main")
    _git(str(repo), "config", "user.email", "t@t.t")
    _git(str(repo), "config", "user.name", "t")
    (repo / "base.txt").write_text("base\n")
    _git(str(repo), "add", "base.txt")
    _git(str(repo), "commit", "-qm", "base")
    _git(str(repo), "remote", "add", "origin", str(remote))
    _git(str(repo), "push", "-qu", "-u", "origin", "main")

    _git(str(root), "clone", "-q", "-b", "main", str(remote), str(actor))
    _git(str(actor), "config", "user.email", "t@t.t")
    _git(str(actor), "config", "user.name", "t")
    return str(repo), str(remote), str(actor)


def _advance_remote(actor: str) -> str:
    path = Path(actor) / "remote.txt"
    path.write_text("new\n")
    _git(actor, "add", "remote.txt")
    _git(actor, "commit", "-qm", "advance main")
    _git(actor, "push", "-q", "origin", "main")
    return _git_out(actor, "rev-parse", "HEAD")


def test_new_worktree_fetches_latest_target_tip():
    repo, _, actor = _fixture("fresh")
    stale_tip = _git_out(repo, "rev-parse", "origin/main")
    latest_tip = _advance_remote(actor)
    assert stale_tip != latest_tip

    path, message = worktree.create_or_reuse(repo, "fresh")

    assert path is not None
    assert _git_out(path, "rev-parse", "HEAD") == latest_tip
    assert message == "created worktree from refreshed origin/main"


def test_new_worktree_refuses_a_stale_base_when_fetch_fails():
    repo, remote, _ = _fixture("offline")
    shutil.rmtree(remote)

    path, message = worktree.create_or_reuse(repo, "offline")

    assert path is None
    assert "base may be stale" in message
    assert _git_out(repo, "branch", "--list", "worktree-offline") == ""


def test_retained_branch_is_resumed_without_rewriting_it():
    repo, _, actor = _fixture("resume")
    retained_tip = _git_out(repo, "rev-parse", "HEAD")
    _git(repo, "branch", "worktree-resume", retained_tip)
    latest_tip = _advance_remote(actor)
    assert retained_tip != latest_tip

    path, message = worktree.create_or_reuse(repo, "resume")

    assert path is not None
    assert _git_out(path, "rev-parse", "HEAD") == retained_tip
    assert message == "reused existing branch"


if __name__ == "__main__":
    run_main(globals())

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


def _add_worktree(repo: str, tag: str) -> str:
    path = Path(repo) / ".worktrees" / tag
    path.parent.mkdir(exist_ok=True)
    branch = f"worktree-{tag}"
    _git(repo, "branch", branch)
    _git(repo, "worktree", "add", "-q", str(path), branch)
    return str(path)


def _add_external_worktree(repo: str, tag: str) -> str:
    path = Path(repo).parent / f"external-{tag}"
    branch = f"external-{tag}"
    _git(repo, "branch", branch)
    _git(repo, "worktree", "add", "-q", str(path), branch)
    return str(path)


def test_reused_worktree_refreshes_shared_home_without_recreating_source():
    from repokit.state import RepositoryState
    from repokit import resolve_home
    from unittest.mock import patch

    repo, _, _ = _fixture("home-reuse")
    existing = _add_worktree(repo, "reuse")
    path, message = worktree.create_or_reuse(repo, "reuse")
    assert path == str(Path(existing).resolve()) and message == "reused existing worktree"
    state = RepositoryState()
    assert state.store.root == resolve_home().resolve()
    assert state.branch(path, "worktree-reuse", max_age=3600).source == "cache"
    with patch.object(RepositoryState, "observe", side_effect=OSError("unavailable")):
        path, message = worktree.create_or_reuse(repo, "reuse")
    assert path is not None and "repository observation unavailable" in message


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


def test_create_and_reuse_leave_reclamation_to_pr_lifecycle():
    repo, _, _ = _fixture("create_without_pruning")
    old = _add_worktree(repo, "old")
    # A leftover legacy setting must not resurrect count-based reclamation.
    config_file = Path(repo) / ".devloop" / "config.json"
    config_file.parent.mkdir(exist_ok=True)
    config_file.write_text('{"worktree":{"keep_recent":0}}')
    created, _ = worktree.create_or_reuse(repo, "new")
    assert created is not None and Path(created).is_dir()
    assert Path(old).is_dir()
    reused, _ = worktree.create_or_reuse(repo, "new")
    assert reused == created and Path(old).is_dir()


def test_repo_context_topology_uses_checkout_locations():
    from domain.context.repo import _build_topology
    repo, _, _ = _fixture("context_checkout_locations")
    metadata = Path(repo).parent / "metadata"
    _git(repo, "init", "--separate-git-dir", str(metadata))
    linked = _add_external_worktree(repo, "context-linked")
    direct = _build_topology(repo, "main", None)
    assert next(b.path for b in direct.worktrees if b.name == "main") == str(Path(repo).resolve())
    observed = _build_topology(linked, "main", None)
    assert next(b.path for b in observed.worktrees if b.name == "main") is None
    assert str(metadata) not in [b.path for b in observed.worktrees]


if __name__ == "__main__":
    run_main(globals())

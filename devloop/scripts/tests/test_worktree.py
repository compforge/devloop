#!/usr/bin/env python3
"""Managed worktrees start fresh without rewriting intentional resumes."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from _testkit import _FakeForge, _git, _git_out, run_main  # noqa: E402  (bootstrap first)
from domain import pull_request_lifecycle, worktree  # noqa: E402
from domain.context import PullRequest, prstate, session, store  # noqa: E402
from domain.forge import ForgeError  # noqa: E402
from lib import git_state  # noqa: E402


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


def _add_submodule(repo: str) -> None:
    source = Path(repo).parent / "submodule-source"
    source.mkdir()
    _git(str(source), "init", "-q", "-b", "main")
    _git(str(source), "config", "user.email", "t@t.t")
    _git(str(source), "config", "user.name", "t")
    (source / "module.txt").write_text("module\n")
    _git(str(source), "add", "module.txt")
    _git(str(source), "commit", "-qm", "submodule base")
    _git(
        repo,
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        "-q",
        str(source),
        "doctor",
    )
    _git(repo, "commit", "-qam", "add submodule")


def _prune(
    repo: str,
    keep: int,
    activity: dict[str, float],
    *,
    keep_path: str | None = None,
) -> None:
    original_config = worktree.config.worktree
    original_activity = worktree._activity
    try:
        worktree.config.worktree = lambda _repo: {"keep_recent": keep}
        worktree._activity = lambda path: activity[Path(path).name]
        worktree._prune_old(repo, keep_path=keep_path)
    finally:
        worktree.config.worktree = original_config
        worktree._activity = original_activity


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


def test_prune_old_removes_surplus_checkout_but_retains_branch():
    repo, _, _ = _fixture("prune_surplus")
    old = _add_worktree(repo, "old")
    recent = _add_worktree(repo, "recent")

    _prune(repo, 1, {"old": 1, "recent": 2})

    assert not Path(old).exists()
    assert Path(recent).is_dir()
    assert _git_out(repo, "branch", "--list", "worktree-old") == "worktree-old"
    assert old not in _git_out(repo, "worktree", "list", "--porcelain")


def test_prune_old_preserves_dirty_and_foreign_owned_worktrees():
    repo, _, _ = _fixture("prune_protected")
    dirty = _add_worktree(repo, "dirty")
    owned = _add_worktree(repo, "owned")
    recent = _add_worktree(repo, "recent")
    (Path(dirty) / "base.txt").write_text("dirty\n")
    assert session.acquire(owned, "other-session", "worktree-owned", pid=os.getpid())

    _prune(
        repo,
        1,
        {"dirty": 1, "owned": 2, "recent": 3},
    )

    assert Path(dirty).is_dir()
    assert Path(owned).is_dir()
    assert Path(recent).is_dir()


def test_prune_old_preserves_the_current_worktree_even_when_ranked_oldest():
    repo, _, _ = _fixture("prune_current")
    current = _add_worktree(repo, "current")
    recent = _add_worktree(repo, "recent")

    _prune(repo, 1, {"current": 1, "recent": 2}, keep_path=current)

    assert Path(current).is_dir()
    assert Path(recent).is_dir()


def test_prune_old_respects_zero_and_negative_retention():
    repo, _, _ = _fixture("prune_retention")
    first = _add_worktree(repo, "first")
    second = _add_worktree(repo, "second")

    _prune(repo, 0, {"first": 1, "second": 2})

    assert not Path(first).exists()
    assert not Path(second).exists()

    disabled = _add_worktree(repo, "disabled")
    _prune(repo, -1, {"disabled": 1})
    assert Path(disabled).is_dir()


def test_local_pull_request_inventory_joins_primary_and_linked_checkouts():
    repo, _, _ = _fixture("local_pr_inventory")
    managed = _add_worktree(repo, "managed")
    external = _add_external_worktree(repo, "linked")
    _git(repo, "branch", "retained")
    head = _git_out(repo, "rev-parse", "HEAD")
    fake = _FakeForge([
        PullRequest(number=1, state="open", source_branch="main", sha=head),
        PullRequest(number=2, state="merged", source_branch="worktree-managed", sha=head),
        PullRequest(number=3, state="closed", source_branch="external-linked", sha=head),
        PullRequest(number=4, state="merged", source_branch="retained", sha=head),
    ])
    original_forge = prstate.forge_for_repo
    try:
        prstate.forge_for_repo = lambda _repo: fake
        payload = prstate.poll_local_pull_requests(repo)
    finally:
        prstate.forge_for_repo = original_forge

    assert payload is not None
    by_branch = {item["branch"]: item for item in payload["branches"]}
    assert by_branch["main"]["checkout"]["kind"] == "primary"
    assert by_branch["worktree-managed"]["checkout"]["kind"] == "managed"
    assert by_branch["external-linked"]["checkout"]["kind"] == "external"
    assert by_branch["retained"]["checkout"] is None
    assert by_branch["worktree-managed"]["checkout"]["path"] == str(Path(managed).resolve())
    assert by_branch["external-linked"]["checkout"]["path"] == str(Path(external).resolve())
    assert {
        item["pull_request"]["state"] for item in by_branch.values()
    } == {"open", "merged", "closed"}


def test_local_pull_request_inventory_is_all_or_nothing_on_forge_failure():
    repo, _, _ = _fixture("local_pr_inventory_failure")
    _add_worktree(repo, "broken")
    head = _git_out(repo, "rev-parse", "HEAD")

    class BrokenForge(_FakeForge):
        def prs_for_branch(self, branch):
            if branch == "worktree-broken":
                raise ForgeError("offline")
            return super().prs_for_branch(branch)

    fake = BrokenForge([
        PullRequest(number=1, state="open", source_branch="main", sha=head),
    ])
    previous = {
        "fetched_at": 1,
        "provider": "github",
        "branches": [],
        "changes": [],
        "actions": [],
    }
    prstate.persist_local_pull_requests(repo, previous)
    original_forge = prstate.forge_for_repo
    try:
        prstate.forge_for_repo = lambda _repo: fake
        assert prstate.refresh_local_pull_requests(repo) is False
    finally:
        prstate.forge_for_repo = original_forge

    assert store.load_segment(repo, "local_pull_requests") == previous


def test_finished_reconciliation_can_remove_the_checkout_it_runs_from():
    repo, _, _ = _fixture("merged_current_checkout")
    current = _add_worktree(repo, "current")
    prstate.persist_local_pull_requests(current, {
        "fetched_at": 1,
        "provider": "github",
        "branches": [{
            "branch": "worktree-current",
            "head_sha": _git_out(current, "rev-parse", "HEAD"),
            "checkout": {
                "path": str(Path(current).resolve()),
                "kind": "managed",
            },
            "pull_request": {
                "number": 1,
                "state": "merged",
                "source_branch": "worktree-current",
            },
        }],
        "actions": [],
    })

    actions = pull_request_lifecycle.reconcile(current)

    assert not Path(current).exists()
    assert [(action.pr_number, action.status, action.reason) for action in actions] == [
        (1, "completed", "removed")
    ]
    snapshot = store.load_segment(repo, "local_pull_requests")
    assert snapshot is not None
    assert snapshot["branches"][0]["checkout"] is None


def test_finished_reconciliation_force_reclaims_dirty_initialized_submodule():
    repo, _, _ = _fixture("finished_initialized_submodule")
    _add_submodule(repo)
    target = _add_worktree(repo, "submodule")
    _git(
        target,
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "update",
        "--init",
        "-q",
    )
    (Path(target) / "doctor" / "module.txt").write_text("dirty\n")
    prstate.persist_local_pull_requests(repo, {
        "fetched_at": 1,
        "provider": "github",
        "branches": [{
            "branch": "worktree-submodule",
            "head_sha": _git_out(target, "rev-parse", "HEAD"),
            "checkout": {"path": target, "kind": "managed"},
            "pull_request": {
                "number": 1,
                "state": "closed",
                "source_branch": "worktree-submodule",
            },
        }],
        "actions": [],
    })

    actions = pull_request_lifecycle.reconcile(repo)

    assert [(action.pr_number, action.status) for action in actions] == [(1, "completed")]
    assert not Path(target).exists()


def test_finished_parent_reclaims_nested_open_checkout_and_projection():
    repo, _, _ = _fixture("finished_parent_nested_open")
    git_state.ensure_gitignore_excluded(repo, "/.worktrees/")
    parent = _add_worktree(repo, "parent")
    nested = Path(parent) / ".worktrees" / "nested"
    _git(repo, "branch", "nested-open")
    _git(repo, "worktree", "add", "-q", str(nested), "nested-open")
    head = _git_out(repo, "rev-parse", "HEAD")
    prstate.persist_local_pull_requests(repo, {
        "fetched_at": 1,
        "provider": "github",
        "branches": [
            {
                "branch": "worktree-parent",
                "head_sha": head,
                "checkout": {"path": parent, "kind": "managed"},
                "pull_request": {
                    "number": 1,
                    "state": "merged",
                    "source_branch": "worktree-parent",
                },
            },
            {
                "branch": "nested-open",
                "head_sha": head,
                "checkout": {"path": str(nested), "kind": "external"},
                "pull_request": {
                    "number": 2,
                    "state": "open",
                    "source_branch": "nested-open",
                },
            },
        ],
        "actions": [],
    })

    actions = pull_request_lifecycle.reconcile(repo)

    assert [(action.pr_number, action.status) for action in actions] == [(1, "completed")]
    assert not Path(parent).exists()
    assert not nested.exists()
    snapshot = store.load_segment(repo, "local_pull_requests")
    assert snapshot is not None
    assert all(item["checkout"] is None for item in snapshot["branches"])


def test_finished_pr_reconciliation_force_reclaims_every_linked_worktree():
    repo, _, _ = _fixture("finished_reconcile")
    completed = _add_worktree(repo, "completed")
    dirty = _add_worktree(repo, "dirty")
    owned = _add_worktree(repo, "owned")
    open_path = _add_worktree(repo, "open")
    closed = _add_worktree(repo, "closed")
    external = _add_external_worktree(repo, "merged")
    (Path(dirty) / "base.txt").write_text("dirty\n")
    _git(repo, "worktree", "lock", dirty)
    assert session.acquire(
        owned,
        "codex-session",
        "worktree-owned",
        harness="codex",
        pid=os.getpid(),
    )

    def local_branch(path: str, kind: str, branch: str, number: int, state: str) -> dict:
        return {
            "branch": branch,
            "head_sha": _git_out(path, "rev-parse", "HEAD"),
            "checkout": {
                "path": str(Path(path).resolve()),
                "kind": kind,
            },
            "pull_request": {
                "number": number,
                "state": state,
                "source_branch": branch,
            },
        }

    payload = {
        "fetched_at": 1,
        "provider": "github",
        "branches": [
            local_branch(repo, "primary", "main", 1, "merged"),
            local_branch(completed, "managed", "worktree-completed", 2, "merged"),
            local_branch(dirty, "managed", "worktree-dirty", 3, "merged"),
            local_branch(owned, "managed", "worktree-owned", 4, "merged"),
            local_branch(open_path, "managed", "worktree-open", 5, "open"),
            local_branch(closed, "managed", "worktree-closed", 6, "closed"),
            local_branch(external, "external", "external-merged", 7, "merged"),
        ],
        "changes": [],
        "actions": [],
    }
    prstate.persist_local_pull_requests(repo, payload)

    actions = pull_request_lifecycle.reconcile(repo)

    for removed in (completed, dirty, owned, closed, external):
        assert not Path(removed).exists()
    for retained in (repo, open_path):
        assert Path(retained).is_dir()
    assert [(a.pr_number, a.status, a.reason) for a in actions] == [
        (2, "completed", "removed"),
        (3, "completed", "removed"),
        (4, "completed", "removed"),
        (6, "completed", "removed"),
        (7, "completed", "removed"),
    ]
    snapshot = store.load_segment(repo, "local_pull_requests")
    assert snapshot is not None
    completed_branch = next(
        item for item in snapshot["branches"] if item["branch"] == "worktree-completed"
    )
    assert completed_branch["checkout"] is None
    assert completed_branch["pull_request"]["state"] == "merged"
    closed_branch = next(
        item for item in snapshot["branches"] if item["branch"] == "worktree-closed"
    )
    assert closed_branch["checkout"] is None
    assert closed_branch["pull_request"]["state"] == "closed"
    assert snapshot["actions"] == [
        {
            "action": "remove_worktree",
            "status": action.status,
            "reason": action.reason,
            "branch": action.branch,
            "pr_number": action.pr_number,
            "path": action.path,
        }
        for action in actions
    ]


def test_local_pull_request_refresh_records_only_authoritative_state_changes():
    repo, _, _ = _fixture("local_pr_changes")
    head = _git_out(repo, "rev-parse", "HEAD")
    fake = _FakeForge([
        PullRequest(number=1, state="open", source_branch="main", sha=head),
    ])
    original_forge = prstate.forge_for_repo
    try:
        prstate.forge_for_repo = lambda _repo: fake
        assert prstate.refresh_local_pull_requests(repo)
        first = store.load_segment(repo, "local_pull_requests")
        assert first["changes"] == [{
            "change": "discovered",
            "branch": "main",
            "pull_request": 1,
            "to": "open",
        }]

        fake._prs[1] = PullRequest(
            number=1,
            state="merged",
            source_branch="main",
            sha=head,
        )
        assert prstate.refresh_local_pull_requests(repo)
        changed = store.load_segment(repo, "local_pull_requests")
        assert changed["changes"] == [{
            "change": "state_changed",
            "branch": "main",
            "pull_request": 1,
            "from": "open",
            "to": "merged",
        }]

        assert prstate.refresh_local_pull_requests(repo)
        stable = store.load_segment(repo, "local_pull_requests")
        assert stable["changes"] == []
    finally:
        prstate.forge_for_repo = original_forge


if __name__ == "__main__":
    run_main(globals())

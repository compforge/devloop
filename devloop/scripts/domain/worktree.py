"""Managed git worktree lifecycle used by the explicit worktree helper.

All devloop-created worktrees live below ``<repo>/.worktrees/``. Keeping creation,
reuse, pruning, and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations

import os
from enum import Enum
from pathlib import Path

from lib import config, ecosystem, git_state, gitcmd

from . import repo_layout
from .context import session


def prepare_environment(path: str) -> list[str]:
    """Prepare every component in a new/reused worktree; return environment warnings."""
    warnings = []
    for component in repo_layout.discover_components(path):
        if problem := ecosystem.ensure_ready(component.path):
            warnings.append(f"component {component.id}: {problem}")
    return warnings


def create_or_reuse(repo_dir: str, tag: str) -> tuple[str | None, str]:
    """Create or reuse ``.worktrees/<tag>``.

    Worktrees live inside the repo, never as siblings. The legacy ``worktrees/`` layout
    remains readable so existing checkouts continue to resolve. The operation is
    idempotent; each call also prunes old managed worktrees and prepares dependencies.
    A genuinely new branch is cut from a freshly fetched ``origin/<target>``. A retained
    branch is resumed as-is: reusing a tag must never rewrite existing work.
    """
    base = Path(repo_dir)
    rel = Path(".worktrees") / tag
    for legacy in (rel, Path("worktrees") / tag):
        if (base / legacy).is_dir():
            path = str((base / legacy).resolve())
            _prune_old(repo_dir, keep_path=path)
            warnings = prepare_environment(path)
            msg = "reused existing worktree"
            if warnings:
                msg += "; environment warning: " + " | ".join(warnings)
            return path, msg

    target = git_state.local_default_target(repo_dir)
    branch = f"worktree-{tag}"
    if git_state.rev_parse(repo_dir, f"refs/heads/{branch}"):
        result = gitcmd.git(repo_dir, "worktree", "add", str(rel), branch, timeout=30)
        message = "reused existing branch"
    else:
        remote_ref = f"origin/{target}"
        refspec = f"+refs/heads/{target}:refs/remotes/origin/{target}"
        if not git_state.fetch(repo_dir, refspec, timeout=30):
            return None, (
                f"could not refresh {remote_ref}; worktree was not created "
                "because its base may be stale"
            )
        if not git_state.rev_parse(repo_dir, remote_ref):
            return None, f"could not resolve refreshed {remote_ref}"
        result = gitcmd.git(
            repo_dir,
            "worktree",
            "add",
            "-b",
            branch,
            str(rel),
            remote_ref,
            timeout=30,
        )
        message = f"created worktree from refreshed {remote_ref}"
    if not result.ok:
        return None, f"worktree add failed for {branch}: {result.err or result.out}"

    path = str((base / rel).resolve())
    _prune_old(repo_dir, keep_path=path)
    warnings = prepare_environment(path)
    if warnings:
        message += "; environment warning: " + " | ".join(warnings)
    return path, message


def _activity(path: str) -> float:
    """Rank by checkout-local directory/index activity, not shared commit time.

    Worktrees branched from the same trunk share a baseline commit, so commit time would
    flatten their ordering. The per-worktree index changes on add/commit/checkout/switch.
    """
    times = []
    try:
        times.append(os.stat(path).st_mtime)
    except OSError:
        pass
    result = gitcmd.git(path, "rev-parse", "--git-path", "index")
    if result.ok and result.out:
        try:
            times.append(os.stat(Path(path) / result.out).st_mtime)
        except OSError:
            pass
    return max(times) if times else 0.0


def _managed(repo_dir: str) -> list[str]:
    """Return only linked worktrees directly below devloop's managed homes.

    External or sibling worktrees created by a human are intentionally excluded and are
    never pruning targets.
    """
    worktrees = git_state.list_worktrees(repo_dir)
    if not worktrees:
        return []
    main = Path(worktrees[0][0]).resolve()
    homes = {main / ".worktrees", main / "worktrees"}
    return [
        str(Path(path).resolve())
        for path, _sha, _branch in worktrees[1:]
        if Path(path).resolve().parent in homes
    ]


class RemovalOutcome(str, Enum):
    """Why a requested managed-worktree cleanup did or did not happen."""

    REMOVED = "removed"
    NOT_MANAGED = "not_managed"
    CURRENT_CHECKOUT = "current_checkout"
    ACTIVE_OWNER = "active_owner"
    DIRTY = "dirty"
    GIT_ERROR = "git_error"


def primary(repo_dir: str) -> str:
    """Return the stable primary checkout used to mutate linked-worktree metadata."""
    worktrees = git_state.list_worktrees(repo_dir)
    if worktrees:
        return str(Path(worktrees[0][0]).resolve())
    return str(Path(repo_dir).resolve())


def remove_if_safe(
    repo_dir: str,
    path: str,
    *,
    protect_path: str | None = None,
) -> RemovalOutcome:
    """Remove one idle managed worktree without touching its branch.

    The target must still be under devloop's managed homes, must not be the caller's
    protected checkout, and must have no live owner from any harness. ``git worktree
    remove`` remains non-force, so dirty checkouts are retained. The operation is
    idempotent and returns a reasoned outcome for lifecycle reporting.
    """
    target = str(Path(path).resolve())
    if target not in _managed(repo_dir):
        return RemovalOutcome.NOT_MANAGED
    if protect_path and target == str(Path(protect_path).resolve()):
        return RemovalOutcome.CURRENT_CHECKOUT
    if session.active_owner(target):
        return RemovalOutcome.ACTIVE_OWNER
    if git_state.get_workspace_status(target)["dirty"]:
        return RemovalOutcome.DIRTY
    if not gitcmd.git(repo_dir, "worktree", "remove", target, timeout=30).ok:
        return RemovalOutcome.GIT_ERROR
    gitcmd.git(repo_dir, "worktree", "prune", timeout=15)
    return RemovalOutcome.REMOVED


def remove_finished(repo_dir: str, path: str) -> RemovalOutcome:
    """Force-reclaim one linked checkout whose PR/MR is already terminal.

    Forge terminal state is the lifecycle authority. A linked checkout is reproducible
    agent workspace: deleting it has bounded recovery cost, while retaining dependency
    trees, submodules, and build output has cumulative disk cost. Dirty state, session
    ownership, locks, initialized submodules, and nested worktrees therefore do not retain
    it. The branch ref remains available if an agent needs to recreate it later. The
    primary checkout is never a valid target because it anchors repository metadata.
    """
    control_repo = primary(repo_dir)
    target = str(Path(path).resolve())
    linked = {
        str(Path(worktree_path).resolve())
        for worktree_path, _sha, _branch in git_state.list_worktrees(control_repo)[1:]
    }
    if target not in linked:
        return RemovalOutcome.NOT_MANAGED

    removed = gitcmd.git(
        control_repo,
        "worktree",
        "remove",
        "--force",
        "--force",
        target,
        timeout=30,
    )
    if not removed.ok:
        return RemovalOutcome.GIT_ERROR
    gitcmd.git(control_repo, "worktree", "prune", timeout=15)
    return RemovalOutcome.REMOVED


def _prune_old(repo_dir: str, keep_path: str | None = None) -> None:
    """Best-effort prune old managed worktrees while preserving live work.

    ``keep_recent`` semantics: positive keeps the N most active, zero removes every
    surplus checkout, negative disables pruning. Removal is non-force, so dirty
    worktrees survive; ``keep_path`` and checkouts owned by any live session are
    skipped. Branches are retained, allowing a later enter to rebuild the checkout.
    """
    keep = config.worktree(repo_dir).get("keep_recent", 5)
    try:
        keep = int(keep)
    except (TypeError, ValueError):
        keep = 5
    if keep < 0:
        return
    managed = _managed(repo_dir)
    if len(managed) <= keep:
        return
    protected = str(Path(keep_path).resolve()) if keep_path else None
    doomed = sorted(managed, key=_activity, reverse=True)[keep:]
    for path in doomed:
        remove_if_safe(repo_dir, path, protect_path=protected)

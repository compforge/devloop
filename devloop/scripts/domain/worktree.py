"""Managed git worktree lifecycle used by the explicit worktree helper.

All devloop-created worktrees live below ``<repo>/.worktrees/``. Keeping creation,
reuse, removal, and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations
from repocli import git as operations
from repocli.git_state import checkout_info

import logging
from enum import Enum
from pathlib import Path

from lib import dependencies, git_state, gitcmd, repocli

from . import repo_layout
from .pull_request import target_base, remember_target
from .forge import ForgeError

logger = logging.getLogger(__name__)


def prepare_environment(path: str) -> list[str]:
    """Prepare every component in a new/reused worktree; return environment warnings."""
    warnings = []
    try:
        components = repo_layout.discover_components(path)
    except repocli.InspectionError as exc:
        return [str(exc)]
    for component in components:
        if problem := dependencies.preparation_problem(component.path):
            warnings.append(f"component {component.id}: {problem}")
    return warnings


def create_or_reuse(repo_dir: str, tag: str, *, target_repo: str | None = None) -> tuple[str | None, str]:
    """Create or reuse ``.worktrees/<tag>``.

    Worktrees live inside the repo, never as siblings. The legacy ``worktrees/`` layout
    remains readable so existing checkouts continue to resolve. The operation is
    idempotent and prepares dependencies. Reclamation belongs exclusively to PR/MR
    lifecycle reconciliation; creating or resuming a checkout never removes another.
    A genuinely new branch is cut from a freshly fetched ``origin/<target>``. A retained
    branch is resumed as-is: reusing a tag must never rewrite existing work.
    """
    branch = f"worktree-{tag}"
    if target_repo is not None and git_state.rev_parse(repo_dir, f"refs/heads/{branch}"):
        requested = target_base(repo_dir, target_repo=target_repo, source_branch=branch)
        existing = target_base(repo_dir, source_branch=branch)
        if requested.repository != existing.repository:
            return None, "existing branch has a different PR target; use a new worktree tag"
    base = Path(repo_dir)
    rel = Path(".worktrees") / tag
    for legacy in (rel, Path("worktrees") / tag):
        if (base / legacy).is_dir():
            path = str((base / legacy).resolve())
            warnings = prepare_environment(path)
            msg = "reused existing worktree"
            if warnings:
                msg += "; environment warning: " + " | ".join(warnings)
            return path, msg

    branch = f"worktree-{tag}"
    if git_state.rev_parse(repo_dir, f"refs/heads/{branch}"):
        result = operations.add_worktree(repo_dir, str(rel), branch)
        message = "reused existing branch"
    else:
        try:
            baseline = target_base(repo_dir, target_repo=target_repo, source_branch=branch)
            baseline.refresh(repo_dir)
        except (ForgeError, OSError) as exc:
            return None, f"{exc}; worktree was not created because its base may be stale"
        remote_ref = baseline.ref
        result = operations.add_worktree(repo_dir, str(rel), remote_ref, branch=branch)
        if result.ok:
            remember_target(repo_dir, branch, baseline.repository)
        message = f"created worktree from refreshed {remote_ref}"
    if not result.ok:
        return None, f"worktree add failed for {branch}: {gitcmd.operation_detail(result)}"

    path = str((base / rel).resolve())
    warnings = prepare_environment(path)
    if warnings:
        message += "; environment warning: " + " | ".join(warnings)
    return path, message


class RemovalOutcome(str, Enum):
    """Why a requested managed-worktree cleanup did or did not happen."""

    REMOVED = "removed"
    NOT_MANAGED = "not_managed"
    GIT_ERROR = "git_error"
    IDENTITY_CHANGED = "identity_changed"
    UNCERTAIN = "uncertain"


def primary(repo_dir: str) -> str:
    """Return the stable primary checkout used to mutate linked-worktree metadata."""
    info = checkout_info(repo_dir)
    return info.main_root or info.root


def remove_finished(repo_dir: str, path: str, *, branch: str, head: str) -> RemovalOutcome:
    """Force-reclaim one linked checkout whose PR/MR is already terminal.

    Forge terminal state is the lifecycle authority. A linked checkout is reproducible
    agent workspace: deleting it has bounded recovery cost, while retaining dependency
    trees, submodules, and build output has cumulative disk cost. Dirty state, session
    ownership, locks, initialized submodules, and nested worktrees therefore do not retain
    it. The branch ref remains available if an agent needs to recreate it later. The
    primary checkout is never a valid target because it anchors repository metadata.

    +spec=`PR/MR terminal state authorizes reclamation only for the observed checkout branch and HEAD`
    +why=`Forge reads can outlive a foreground checkout change; path membership alone is not identity`
    +why=`Gitlinks are opaque repository entries; child checkout contents add no retention policy`
    +link=`component://scripts/domain/pull_request_lifecycle.py`
    """
    control_repo = primary(repo_dir)
    target = str(Path(path).resolve())
    try:
        current = next((entry for entry in git_state.list_checkouts(control_repo)
                        if not entry.primary and entry.path == target), None)
    except OSError as exc:
        logger.warning("worktree identity read failed: path=%s detail=%s", target, exc)
        return RemovalOutcome.GIT_ERROR
    if current is None:
        return RemovalOutcome.NOT_MANAGED
    if not branch or not head or current.branch != branch or current.head != head:
        logger.info("worktree removal deferred: path=%s expected_branch=%s expected_head=%s "
                    "current_branch=%s current_head=%s reason=identity_changed",
                    target, branch, head, current.branch, current.head)
        return RemovalOutcome.IDENTITY_CHANGED

    removed = operations.remove_worktree(control_repo, target, force=True)
    if not removed.ok:
        logger.warning("worktree removal failed: path=%s detail=%s", target, gitcmd.operation_detail(removed))
        return RemovalOutcome.UNCERTAIN if removed.uncertain else RemovalOutcome.GIT_ERROR
    logger.info("finished worktree removed: path=%s", target)
    operations.prune_worktrees(control_repo)
    return RemovalOutcome.REMOVED

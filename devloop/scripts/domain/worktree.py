"""Managed git worktree lifecycle used by the explicit worktree helper.

All devloop-created worktrees live below ``<repo>/.worktrees/``. Keeping creation,
reuse and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations
from repokit import git as operations
from repokit.git.state import checkout_info

import logging
from pathlib import Path

from lib import dependencies, git_state, gitcmd, repokit

from . import repo_layout

logger = logging.getLogger(__name__)


def prepare_environment(path: str) -> list[str]:
    """Prepare every component in a new/reused worktree; return environment warnings."""
    warnings = []
    try:
        components = repo_layout.discover_components(path)
    except repokit.InspectionError as exc:
        return [str(exc)]
    for component in components:
        if problem := dependencies.preparation_problem(component.path):
            warnings.append(f"component {component.id}: {problem}")
    return warnings


def create_or_reuse(repo_dir: str, tag: str) -> tuple[str | None, str]:
    """Create or reuse ``.worktrees/<tag>``.

    Worktrees live inside the repo, never as siblings. The legacy ``worktrees/`` layout
    remains readable so existing checkouts continue to resolve. The operation is
    idempotent and prepares dependencies. Reclamation belongs exclusively to PR/MR
    lifecycle reconciliation; creating or resuming a checkout never removes another.
    A genuinely new branch is cut from a freshly fetched ``origin/<target>``. A retained
    branch is resumed as-is: reusing a tag must never rewrite existing work.
    """
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

    target = git_state.local_default_target(repo_dir)
    branch = f"worktree-{tag}"
    if git_state.rev_parse(repo_dir, f"refs/heads/{branch}"):
        result = operations.add_worktree(repo_dir, str(rel), branch)
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
        result = operations.add_worktree(repo_dir, str(rel), remote_ref, branch=branch)
        message = f"created worktree from refreshed {remote_ref}"
    if not result.ok:
        return None, f"worktree add failed for {branch}: {gitcmd.operation_detail(result)}"

    path = str((base / rel).resolve())
    warnings = prepare_environment(path)
    if warnings:
        message += "; environment warning: " + " | ".join(warnings)
    return path, message


def primary(repo_dir: str) -> str:
    """Return the stable primary checkout used to mutate linked-worktree metadata."""
    info = checkout_info(repo_dir)
    return info.main_root or info.root

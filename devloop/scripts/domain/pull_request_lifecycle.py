"""Workflow reclamation policy over repocli PR/branch queries and live Git identity."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from . import worktree
from .forge import Forge, ForgeError
from lib.forge import pr_context_for_repo
from repokit.forge import PullRequestContext, BranchPullRequests
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReconcileAction:
    """One lifecycle reaction returned in the task report."""

    action: str
    status: str
    reason: str
    branch: str
    pr_number: int
    path: str


def reconcile(repo: str, *, forge: Forge | None = None, context: PullRequestContext | None = None, inventory: tuple[BranchPullRequests, ...] | None = None) -> list[ReconcileAction]:
    """Apply lifecycle reactions to individually verified branch observations.

    A finished PR/MR (merged or closed) makes its linked worktree reclaimable. Forge
    state is authoritative: dirty state, owner locks, initialized submodules, nested
    worktrees, and whether the checkout was devloop-managed do not retain it. The primary
    checkout remains the repository anchor and is never a deletion target.
    """
    owned = context is None
    context = context or pr_context_for_repo(repo, forge=forge)
    if context is None:
        return []
    try:
        rows = inventory if inventory is not None else context.local_branches()
        return _reconcile(worktree.primary(repo), context, rows)
    finally:
        if owned:
            context.observer.close()


def _reconcile(repo: str, context: PullRequestContext, rows: tuple[BranchPullRequests, ...]) -> list[ReconcileAction]:
    actions: list[ReconcileAction] = []
    candidates = [(row, checkout.path) for row in rows
                  if not row.error and not row.ambiguous and row.selected and row.selected.inactive
                  for checkout in row.checkouts if not checkout.primary and checkout.path]
    # Nested checkouts must receive their own action before their parent is removed.
    candidates.sort(key=lambda item: len(Path(item[1]).parts), reverse=True)
    for row, path in candidates:
        pr = row.selected
        assert pr is not None
        # +spec=`Reverify association before removal; live branch/HEAD/checkout identity
        # is checked again by remove_finished at the mutation boundary.`
        try:
            observed = context.verify(row)
            current = observed.selected
            if observed.error or observed.ambiguous or current is None or not current.inactive or (current.number, current.target_repository) != (pr.number, pr.target_repository):
                raise ForgeError("branch PR association changed; refresh before removal")
        except (ForgeError, OSError, ValueError) as exc:
            logger.warning("checkout removal deferred repo=%s branch=%s pr=%s error=%s",
                           repo, row.branch, pr.number, exc)
            actions.append(ReconcileAction("remove_worktree", "deferred", "forge_unverified",
                                           row.branch, pr.number, path))
            continue
        outcome = worktree.remove_finished(repo, path, branch=row.branch, head=row.head)
        actions.append(ReconcileAction(
            "remove_worktree", "completed" if outcome is worktree.RemovalOutcome.REMOVED else "deferred",
            outcome.value, row.branch, pr.number, path,
        ))
    return actions

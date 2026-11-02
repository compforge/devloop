"""Workflow reclamation policy over repocli PR/branch queries and live Git identity."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from . import worktree
from .context import prstate
from .forge import Forge, ForgeError
from lib.forge import pr_context_for_repo
from repocli.forge import PullRequestContext
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


def reconcile(repo: str, *, forge: Forge | None = None, context: PullRequestContext | None = None, inventory: dict | None = None) -> list[ReconcileAction]:
    """Apply lifecycle reactions to individually verified branch observations.

    A finished PR/MR (merged or closed) makes its linked worktree reclaimable. Forge
    state is authoritative: dirty state, owner locks, initialized submodules, nested
    worktrees, and whether the checkout was devloop-managed do not retain it. The primary
    checkout remains the repository anchor and is never a deletion target.
    """
    control_repo = worktree.primary(repo)
    context = context or pr_context_for_repo(repo, forge=forge)
    if context is None:
        return []
    payload = inventory if inventory is not None else prstate.inventory_view(context)
    actions: list[ReconcileAction] = []
    candidates = []
    for local_branch in payload.get("branches") or []:
        pr = local_branch.get("pull_request") or {}
        checkout = local_branch.get("checkout") or {}
        if checkout.get("kind") == "primary" or pr.get("state") not in {"merged", "closed"}:
            continue
        path = str(checkout.get("path") or "")
        if not path:
            continue
        candidates.append((local_branch, pr, path))

    # Remove deepest checkouts first so a terminal nested worktree gets its own completed
    # action before a terminal parent recursively removes the containing directory.
    candidates.sort(key=lambda item: len(Path(item[2]).parts), reverse=True)
    for local_branch, pr, path in candidates:
        # +spec=`A cached terminal PR never authorizes removal. Revalidate the branch
        # association and then let remove_finished verify the live local identity.`
        branch = str(local_branch.get("branch") or "")
        try:
            observed = context.verify(local_branch["context"])
            current = observed.selected
            if current is None or not current.inactive or (current.number, current.target_repository) != (int(pr["number"]), pr["target_repository"]):
                raise ForgeError("branch PR association changed; refresh before removal")
        except (ForgeError, OSError) as exc:
            logger.warning("checkout removal deferred repo=%s branch=%s pr=%s error=%s",
                           repo, branch, pr["number"], exc)
            actions.append(ReconcileAction("remove_worktree", "deferred", "forge_unverified",
                                           branch, int(pr["number"]), path))
            continue
        outcome = worktree.remove_finished(
            control_repo, path,
            branch=str(local_branch.get("branch") or ""),
            head=str(local_branch.get("head_sha") or ""),
        )
        action = ReconcileAction(
            action="remove_worktree",
            status="completed" if outcome is worktree.RemovalOutcome.REMOVED else "deferred",
            reason=outcome.value,
            branch=str(local_branch.get("branch") or ""),
            pr_number=int(pr["number"]),
            path=path,
        )
        actions.append(action)
    return actions

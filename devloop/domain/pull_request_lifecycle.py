"""Reconcile local branch resources from authoritative PR/MR state.

Forge observation and checkout mutation stay separate: ``context.prstate`` owns the
snapshot, ``worktree`` owns safe resource removal, and this module owns the small policy
that maps one to the other. Reconciliation is desired-state based and idempotent, so an
offline monitor can catch up later without having observed the exact state transition.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from . import worktree
from .context import prstate, store


@dataclass(frozen=True)
class ReconcileAction:
    """One lifecycle reaction retained in the latest local inventory snapshot."""

    action: str
    status: str
    reason: str
    branch: str
    pr_number: int
    path: str


def reconcile(repo: str) -> list[ReconcileAction]:
    """Apply safe lifecycle reactions for the latest complete local PR/MR snapshot.

    A merged PR/MR makes only its *managed* worktree reclaimable. Primary and external
    worktrees remain user-owned; closed-but-unmerged branches remain available; dirty,
    active, or currently protected managed worktrees are deferred by ``remove_if_safe``.
    """
    payload = store.load_segment(repo, "local_pull_requests")
    if payload is None:
        return []
    actions: list[ReconcileAction] = []
    removed: set[str] = set()
    for local_branch in payload.get("branches") or []:
        pr = local_branch.get("pull_request") or {}
        checkout = local_branch.get("checkout") or {}
        if checkout.get("kind") != "managed" or pr.get("state") != "merged":
            continue
        path = str(checkout.get("path") or "")
        if not path:
            continue
        outcome = worktree.remove_if_safe(repo, path, protect_path=repo)
        action = ReconcileAction(
            action="remove_worktree",
            status="completed" if outcome is worktree.RemovalOutcome.REMOVED else "deferred",
            reason=outcome.value,
            branch=str(local_branch.get("branch") or ""),
            pr_number=int(pr["number"]),
            path=path,
        )
        actions.append(action)
        if outcome is worktree.RemovalOutcome.REMOVED:
            removed.add(path)

    # The local branch and its merged PR/MR outlive a reclaimed checkout. Keep that
    # lifecycle record and clear only its optional checkout projection. Deferred
    # actions stay visible and are retried on the next authoritative sweep.
    for local_branch in payload.get("branches") or []:
        checkout = local_branch.get("checkout") or {}
        if checkout.get("path") in removed:
            local_branch["checkout"] = None
    payload["actions"] = [asdict(action) for action in actions]
    prstate.persist_local_pull_requests(repo, payload)
    return actions

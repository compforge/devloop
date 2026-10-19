"""Reconcile local branch resources from authoritative PR/MR state.

Forge observation and checkout mutation stay separate: ``context.prstate`` owns the
snapshot, ``worktree`` owns resource removal, and this module owns the small policy
that maps one to the other. Reconciliation is desired-state based and idempotent, so an
offline monitor can catch up later without having observed the exact state transition.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

from . import worktree
from .context import prstate, store
from .forge import Forge, ForgeError, ForgeRateLimited
from lib.forge import forge_for_repo
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReconcileAction:
    """One lifecycle reaction retained in the latest local inventory snapshot."""

    action: str
    status: str
    reason: str
    branch: str
    pr_number: int
    path: str


def reconcile(repo: str, *, forge: Forge | None = None) -> list[ReconcileAction]:
    """Apply lifecycle reactions for the latest complete local PR/MR snapshot.

    A finished PR/MR (merged or closed) makes its linked worktree reclaimable. Forge
    state is authoritative: dirty state, owner locks, initialized submodules, nested
    worktrees, and whether the checkout was devloop-managed do not retain it. The primary
    checkout remains the repository anchor and is never a deletion target.
    """
    control_repo = worktree.primary(repo)
    payload = store.load_segment(control_repo, "local_pull_requests")
    if payload is None:
        return []
    actions: list[ReconcileAction] = []
    removed: set[str] = set()
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
    if candidates:
        forge = forge if forge is not None else forge_for_repo(repo)
    for local_branch, pr, path in candidates:
        # +spec=`A cached terminal PR never authorizes removal. Revalidate the branch
        # association and then let remove_finished verify the live local identity.`
        branch = str(local_branch.get("branch") or "")
        head = str(local_branch.get("head_sha") or "")
        try:
            if forge is None:
                raise ForgeError("no usable forge for checkout removal")
            current = prstate.pick_branch_pr(forge.prs_for_branch(branch), repo, head)
            if current is None or not current.inactive or current.number != int(pr["number"]):
                raise ForgeError("branch PR association changed; refresh before removal")
        except (ForgeError, OSError) as exc:
            if isinstance(exc, ForgeRateLimited):
                prstate.record_failure(repo, "lifecycle", exc)
            else:
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
        if outcome is worktree.RemovalOutcome.REMOVED:
            removed.add(path)

    # The local branch and its finished PR/MR outlive a reclaimed checkout. Keep that
    # lifecycle record and clear only its optional checkout projection. A reclaimed
    # parent also removes nested linked checkouts, including ones whose own PR/MR is open.
    # Deferred actions stay visible and are retried on the next authoritative sweep.
    removed_roots = [Path(path).resolve() for path in removed]
    for local_branch in payload.get("branches") or []:
        checkout = local_branch.get("checkout") or {}
        checkout_path = str(checkout.get("path") or "")
        if not checkout_path:
            continue
        candidate = Path(checkout_path).resolve()
        if any(candidate == root or root in candidate.parents for root in removed_roots):
            local_branch["checkout"] = None
    payload["actions"] = [asdict(action) for action in actions]
    prstate.persist_local_pull_requests(control_repo, payload)
    return actions

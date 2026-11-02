"""Transient workflow views over repocli PR queries; remote trunk tips remain workflow state."""
from __future__ import annotations

import logging
from dataclasses import asdict
from pathlib import Path

from repocli.forge import PullRequestContext
from lib import git_state
from lib.forge import forge_for_repo, pr_context_for_repo
from domain.forge import Forge, ForgeError
from . import base, store

TRUNK_CANDIDATES = ("main", "master", "release")
logger = logging.getLogger(__name__)


def _baseline_branches(repo: str) -> tuple[str, ...]:
    """The branches whose remote tip matters for THIS repo: the conventional trunks plus the
    repo's default branch (`meta.default_branch`) and the recorded `fork_from` (branch segment).
    Without this a non-conventional baseline would have no tracked tip and the 'trunk moved'
    signal would never fire for it."""
    mseg = store.load_segment(repo, "meta") or {}
    bseg = store.load_segment(repo, "branch") or {}
    extra = ((mseg.get("repo") or {}).get("default_branch"), (bseg.get("local") or {}).get("fork_from"))
    seen: set[str] = set()
    out: list[str] = []
    for b in (*TRUNK_CANDIDATES, *(e for e in extra if e)):
        if b not in seen:
            seen.add(b)
            out.append(b)
    return tuple(out)


def poll_pr(repo: str, *, forge: Forge | None = None, required: bool = False) -> dict | None:
    """Build a current view; no PR snapshot is written into .devloop."""
    context = pr_context_for_repo(repo, forge=forge)
    if context is None:
        return None
    try:
        current = context.get_checkout()
        if current and current.error:
            raise ForgeError(current.error)
        if current and current.ambiguous:
            raise ForgeError("multiple PRs match this branch; select a proposal explicitly")
        return {"branch": current.branch if current else None, "head_sha": current.head if current else "",
                "provider": context.observer.reader.provider,
                "pr_number": current.selected.number if current and current.selected else None,
                "prs": [asdict(current.selected)] if current and current.selected else [],
                "checked_at": base.now()}
    except (ForgeError, OSError) as exc:
        if required:
            raise
        logger.warning("PR view unavailable repo=%s error=%s", repo, exc)
        return None
    finally:
        context.observer.close()


def inventory_view(context: PullRequestContext) -> dict:
    """Keep each branch's availability and ambiguity visible to workflow policy."""
    rows = []
    for item in context.local_branches():
        for checkout in item.checkouts or (None,):
            rows.append({"branch": item.branch, "head_sha": item.head,
                         "checkout": {"path": checkout.path, "kind": "primary" if checkout.primary else "external"} if checkout else None,
                         "pull_request": asdict(item.selected) if item.selected else None,
                         "observation": "unknown" if item.error else "ambiguous" if item.ambiguous else "known",
                         "error": item.error, "context": item})
    return {"provider": context.observer.reader.provider, "branches": rows}


# ── remote_branches.json (the server's trunk tips; read-freshness baseline) ────
def poll_remote_branches(repo: str, branches: tuple[str, ...] = TRUNK_CANDIDATES) -> dict | None:
    """`git ls-remote` the candidate trunk branches → the `remote_branches` payload, or None
    offline. No object fetch (cheap); the SHAs are the TRUE remote tips — a colleague's push is
    visible here before any local fetch, which is the whole point of polling them."""
    try:
        tips = git_state.ls_remote_tips(repo, *branches)
    except OSError:
        return None
    if not tips:
        return None
    return {
        "fetched_at": base.now(),
        "remotes": [{"name": name, "commit": sha} for name, sha in sorted(tips.items())],
    }


def persist_remote_branches(repo: str, payload: dict) -> None:
    """Write the monitor-owned `remote_branches` segment (sole writer)."""
    git_state.ensure_gitignore_excluded(repo)
    store.save_segment(repo, "remote_branches", payload)


def refresh_remote_branches(repo: str, branches: tuple[str, ...] | None = None) -> bool:
    """Poll + persist the server's trunk tips. Tracks the repo's actual baseline (target /
    fork_from) on top of the conventional trunks unless `branches` is given. Best-effort;
    returns whether written."""
    payload = poll_remote_branches(repo, branches or _baseline_branches(repo))
    if payload is None:
        return False
    persist_remote_branches(repo, payload)
    return True


def review_details(repo: str, proposal: dict) -> dict:
    """Review findings are workflow facts, queried separately from lifecycle gates."""
    from domain import review_feedback
    if not proposal.get("pr_number"):
        return {}
    forge = forge_for_repo(repo)
    if forge is None:
        return {}
    pr = next((row for row in proposal.get("prs", []) if row["number"] == proposal["pr_number"]), None)
    if not pr or pr["state"] != "open":
        return {}
    target = forge.for_repository(pr["target_repository"])
    result = {}
    try:
        findings = review_feedback.pending(target.comments(pr["number"]))
        result.update(pending_review_verdicts=len(findings),
                      pending_review_verdicts_key=review_feedback.pending_key(findings))
    except ForgeError as exc:
        logger.warning("PR review view unavailable repo=%s pr=%s error=%s", repo, pr["number"], exc)
    try:
        result["merge_readiness"] = target.merge_readiness(pr["number"]).value
    except ForgeError as exc:
        logger.warning("PR readiness unavailable repo=%s pr=%s error=%s", repo, pr["number"], exc)
    return result

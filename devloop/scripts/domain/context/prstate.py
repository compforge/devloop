"""PR / remote-branch state acquisition — the shared library the monitor AND gcampr use to
pull the forge + the server's trunk tips into the monitor-owned segments.

It lives in `domain` (not the monitor *script*) so the gate path (`domain.context.gate`) and gcampr
can trigger an AUTHORITATIVE refresh without importing a script — the old arrangement had the
poll logic in `scripts/poll_pr_status.py` and gcampr reached back into it, then discarded the
result (a silent no-op). Both writers go through here.

Three monitor-owned segments, stamped so a reader can tell how fresh they are:
- `pr.json` — the current branch's PR/MR number (SHA-ancestry validated) + a recent window.
- `local_pull_requests.json` — every local branch joined to its current PR/MR and optional
  checkout, so lifecycle reconciliation still sees branches after worktree reclamation.
- `remote_branches.json` — the server's trunk tips (`{name, commit}`) + `fetched_at`, the
  read-freshness baseline (a colleague's push moves trunk under you, an unobservable channel).
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path

from lib import git_state
from domain.forge import ForgeError, build_window
from lib.forge import forge_for_repo

from .. import review_feedback
from . import base, store

# Conventional trunk names to track remote tips for. ls-remote returns only those that exist, so
# tracking all of them (a) survives `origin/HEAD` pointing at a dead placeholder and (b) covers
# repos with more than one protected branch (e.g. release + master). The repo's actual baseline
# (its `target` / recorded `fork_from`, which may be `develop` / `release/x` / `staging`) is
# unioned in by `_baseline_branches` so the staleness signal isn't limited to these defaults.
TRUNK_CANDIDATES = ("main", "master", "release")


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


# ── PR selection (SHA-ancestry validated; reused by the monitor AND the gate) ──
def pick_branch_pr(branch_prs: list, repo: str, head_sha: str):
    """Choose the PR/MR that represents the branch at `head_sha` (or None).

    Open PR wins (branch reused for new work). Otherwise the most-recent finished PR whose
    source SHA is reachable from HEAD — a dead-ref PR (same branch NAME, unrelated history,
    e.g. delete+rebuild) is skipped so it can't mark a rebuilt branch inactive. Running this
    SHA check against the LIVE head is why a gate keys PR-ownership on (branch, head_sha), not
    branch name alone (see docs/branch-state.md §write-gate)."""
    opens = [p for p in branch_prs if p.is_open]
    if opens:
        return opens[0]
    for p in branch_prs:                       # forge.list() returns created desc
        if git_state.is_ancestor(repo, p.sha, head_sha):
            return p
    return None


# ── pr.json (the current branch's PR + recent window) ──────────────────────────
def poll_pr(repo: str) -> dict | None:
    """One forge poll → the `pr` segment payload (current branch's PR window), or None when
    the repo has no usable forge / remote. Side-effect-free; `persist_pr` writes it."""
    forge = forge_for_repo(repo)
    if forge is None:
        return None
    branch = git_state.get_current_branch(repo)
    head = git_state.get_head_sha(repo)
    try:
        branch_pr = pick_branch_pr(forge.prs_for_branch(branch), repo, head) if branch else None
        anchor = branch_pr.number if branch_pr else None
        window = build_window(forge, anchor)
    except ForgeError:
        return None
    # Readiness is a derived verdict over source×target tips (goes stale when either moves), so we
    # compute it live HERE per poll rather than storing it on each PullRequest — see MergeReadiness.
    # Only for the current branch's OPEN MR (a finished/absent PR has nothing to nag about); its own
    # guard so a readiness-fetch failure degrades to "unknown", not a lost window.
    readiness = None
    if branch_pr and branch_pr.is_open:
        try:
            readiness = forge.merge_readiness(anchor).value
        except ForgeError:
            readiness = None
    # Findings still awaiting a `ccr:label` verdict — a peer of readiness: derived from the
    # forge, cached here, never authoritative. It's computed at the POLL boundary (not per
    # turn) because that's where the forge round-trip already is; the turn context reads the
    # cached number. Safe to cache precisely because review_feedback can always re-derive it
    # from comment bodies — losing this segment costs a stale count, never the join itself.
    # Own guard: a comments() failure degrades to "unknown", it must not cost us the window.
    pending_review_verdicts, pending_review_verdicts_key = None, ""
    if branch_pr and branch_pr.is_open:
        try:
            _pend = review_feedback.pending(forge.comments(anchor))
            pending_review_verdicts = len(_pend)
            # Set identity, not just the count — the nudge decays per SITUATION, and a count
            # can't distinguish "same findings, still unlabeled" from new work.
            pending_review_verdicts_key = review_feedback.pending_key(_pend)
        except ForgeError:
            pending_review_verdicts, pending_review_verdicts_key = None, ""
    return {
        "branch": branch,
        "head_sha": head,          # provenance: the HEAD this window was selected against
        "provider": forge.provider,
        "pr_number": anchor,
        "merge_readiness": readiness,   # current branch's open MR; None when no open MR / unknown
        "pending_review_verdicts": pending_review_verdicts,
        "pending_review_verdicts_key": pending_review_verdicts_key,
        "prs": [asdict(p) for p in window],
    }


def persist_pr(repo: str, payload: dict) -> None:
    """Write the monitor-owned `pr` segment (sole writer; no lock, no lost update)."""
    git_state.ensure_gitignore_excluded(repo)   # keep /.devloop/ out of git if pr.json is first
    store.save_segment(repo, "pr", payload)


def refresh_pr(repo: str) -> bool:
    """Poll + persist the `pr` segment in one shot — the authoritative refresh a low-frequency
    gate (gcampr) triggers so it decides on LIVE PR state, not a possibly-stale monitor cache.
    (The old `refresh_pr_state` polled and DISCARDED the result — a silent no-op.) Best-effort;
    returns whether anything was written."""
    payload = poll_pr(repo)
    if payload is None:
        return False
    persist_pr(repo, payload)
    return True


# ── local_pull_requests.json (all local branches joined to forge state) ──────
def _checkout_kind(main: Path, path: Path) -> str:
    if path == main:
        return "primary"
    if path.parent in {main / ".worktrees", main / "worktrees"}:
        return "managed"
    return "external"


def poll_local_pull_requests(repo: str) -> dict | None:
    """Join every local branch to its authoritative PR/MR, or return ``None`` offline.

    This is deliberately separate from :func:`poll_pr`: gates need one current branch
    with low latency, while reconciliation needs the complete local lifecycle inventory.
    A branch may have a primary, managed, or external checkout, or no checkout after an
    old worktree was reclaimed. Forge reads use an explicit small concurrency bound so a
    repository with retained branches does not serialize one network timeout per branch.

    The snapshot is all-or-nothing. A failed branch lookup returns ``None`` rather than a
    partial inventory, because absence from a partial list must never authorize cleanup.
    """
    forge = forge_for_repo(repo)
    branches = git_state.list_local_branches(repo)
    worktrees = git_state.list_worktrees(repo)
    if forge is None:
        return None
    main = Path(worktrees[0][0]).resolve() if worktrees else Path(repo).resolve()
    checkout_by_branch = {
        branch: {
            "path": str(Path(path).resolve()),
            "kind": _checkout_kind(main, Path(path).resolve()),
        }
        for path, _head, branch in worktrees
        if branch
    }

    def lookup(item: tuple[str, str]) -> tuple[str, object | None]:
        branch, head = item
        prs = forge.prs_for_branch(branch)
        return branch, pick_branch_pr(prs, repo, head)

    try:
        workers = min(base.LOCAL_PR_POLL_CONCURRENCY, len(branches))
        with ThreadPoolExecutor(max_workers=workers or 1) as executor:
            pr_by_branch = dict(executor.map(lookup, branches))
        local_branches = [
            {
                "branch": branch,
                "head_sha": head,
                "checkout": checkout_by_branch.get(branch),
                "pull_request": asdict(pr_by_branch[branch]) if pr_by_branch[branch] else None,
            }
            for branch, head in branches
        ]
    except ForgeError:
        return None
    return {
        "fetched_at": base.now(),
        "provider": forge.provider,
        "branches": local_branches,
        "changes": [],
        "actions": [],
    }


def persist_local_pull_requests(repo: str, payload: dict) -> None:
    """Write the monitor-owned local branch ↔ PR/MR inventory."""
    git_state.ensure_gitignore_excluded(repo)
    store.save_segment(repo, "local_pull_requests", payload)


def refresh_local_pull_requests(repo: str) -> bool:
    """Poll + persist the complete local branch inventory, best-effort."""
    previous = store.load_segment(repo, "local_pull_requests") or {}
    payload = poll_local_pull_requests(repo)
    if payload is None:
        return False
    previous_by_number = {
        int(pr["number"]): (item.get("branch") or "", pr.get("state") or "")
        for item in previous.get("branches") or []
        if (pr := item.get("pull_request")) and pr.get("number") is not None
    }
    changes = []
    for item in payload.get("branches") or []:
        pr = item.get("pull_request") or {}
        if pr.get("number") is None:
            continue
        number = int(pr["number"])
        branch = item.get("branch") or ""
        state = pr.get("state") or ""
        prior = previous_by_number.get(number)
        if prior is None:
            changes.append({
                "change": "discovered",
                "branch": branch,
                "pull_request": number,
                "to": state,
            })
        elif prior[1] != state:
            changes.append({
                "change": "state_changed",
                "branch": branch,
                "pull_request": number,
                "from": prior[1],
                "to": state,
            })
    payload["changes"] = changes
    persist_local_pull_requests(repo, payload)
    return True


# ── remote_branches.json (the server's trunk tips; read-freshness baseline) ────
def poll_remote_branches(repo: str, branches: tuple[str, ...] = TRUNK_CANDIDATES) -> dict | None:
    """`git ls-remote` the candidate trunk branches → the `remote_branches` payload, or None
    offline. No object fetch (cheap); the SHAs are the TRUE remote tips — a colleague's push is
    visible here before any local fetch, which is the whole point of polling them."""
    tips = git_state.ls_remote_tips(repo, *branches)
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

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

import logging
import fcntl
import time
from contextlib import contextmanager
from collections.abc import Iterator
from dataclasses import asdict
from pathlib import Path

from lib import git_state
from domain.forge import Forge, ForgeError, ForgeRateLimited, PullRequest, PRS_CAP, build_window
from lib.forge import forge_for_repo

from .. import review_feedback
from . import base, store

# Conventional trunk names to track remote tips for. ls-remote returns only those that exist, so
# tracking all of them (a) survives `origin/HEAD` pointing at a dead placeholder and (b) covers
# repos with more than one protected branch (e.g. release + master). The repo's actual baseline
# (its `target` / recorded `fork_from`, which may be `develop` / `release/x` / `staging`) is
# unioned in by `_baseline_branches` so the staleness signal isn't limited to these defaults.
TRUNK_CANDIDATES = ("main", "master", "release")
HISTORY_INTERVAL = 3600
HISTORY_BATCH = 20
DETAILS_INTERVAL = 600
logger = logging.getLogger(__name__)


@contextmanager
def _pr_write(repo: str) -> Iterator[None]:
    """Serialize only snapshot publication; no network calls while holding this lock."""
    home = store.tmp_dir(repo)
    home.mkdir(parents=True, exist_ok=True)
    with (home / "pr-view.lock").open("a") as lock:
        deadline = time.monotonic() + 2
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"PR view writer busy: {repo}")
                time.sleep(0.02)
        yield


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
        # Missing identities cannot establish ownership; failed ancestry reads propagate
        # so a monitor retains its snapshot and a write gate stops.
        if p.sha and head_sha and git_state.is_ancestor(repo, p.sha, head_sha):
            return p
    return None


# ── pr.json (the current branch's PR + recent window) ──────────────────────────
def poll_pr(repo: str, *, forge: Forge | None = None, inventory: dict | None = None,
            required: bool = False) -> dict | None:
    """One forge poll → the `pr` segment payload (current branch's PR window), or None when
    the repo has no usable forge / remote. Failed attempts are recorded separately."""
    forge = forge if forge is not None else forge_for_repo(repo)
    if forge is None:
        return None
    try:
        branch = git_state.get_current_branch(repo)
        head = git_state.get_head_sha(repo)
        if inventory is None:
            branch_pr = pick_branch_pr(forge.prs_for_branch(branch), repo, head) if branch else None
            checked_at = base.now()
        else:
            row = next((r for r in inventory["branches"] if r["branch"] == branch), {})
            raw = row.get("pull_request")
            branch_pr = PullRequest.from_dict(raw) if raw else None
            checked_at = row.get("checked_at", 0)
        anchor = branch_pr.number if branch_pr else None
    except (ForgeError, OSError) as exc:
        record_failure(repo, "current", exc)
        if required:
            raise
        return None
    previous = store.load_segment(repo, "pr") or {}
    # A current-branch decision cannot inherit an old candidate for that branch.
    window = [p for p in previous.get("prs", []) if p.get("source_branch") != branch]
    if branch_pr:
        window = [asdict(branch_pr), *window][:PRS_CAP]
    window.sort(key=lambda p: p["number"], reverse=True)
    same = previous.get("pr_number") == anchor and previous.get("branch") == branch
    return {
        "branch": branch,
        "head_sha": head,          # provenance: the HEAD this window was selected against
        "provider": forge.provider,
        "pr_number": anchor,
        "checked_at": checked_at,
        "merge_readiness": previous.get("merge_readiness") if same else None,
        "pending_review_verdicts": previous.get("pending_review_verdicts") if same else None,
        "pending_review_verdicts_key": previous.get("pending_review_verdicts_key", "") if same else "",
        "details_checked_at": previous.get("details_checked_at", 0) if same else 0,
        "prs": window,
    }


def refresh_pr_details(repo: str, forge: Forge, *, force: bool = False) -> bool:
    """Advisory data has its own freshness, independent of authoritative branch reads."""
    payload = store.load_segment(repo, "pr")
    if not payload:
        return False
    if not force and not base.is_stale(payload.get("details_checked_at"), DETAILS_INTERVAL):
        return True
    anchor = payload.get("pr_number")
    try:
        raw = next((p for p in payload["prs"] if p["number"] == anchor), None)
        window = build_window(forge, anchor, anchor_pr=PullRequest.from_dict(raw) if raw else None)
        current = next((p for p in window if p.number == anchor and p.is_open), None)
        readiness, pending, key = None, None, ""
        if current:
            readiness = forge.merge_readiness(anchor).value
            findings = review_feedback.pending(forge.comments(anchor))
            pending, key = len(findings), review_feedback.pending_key(findings)
    except ForgeError as exc:
        record_failure(repo, "details", exc)
        return False
    # +spec=`A slow auxiliary read cannot overwrite a newer authoritative observation.`
    with _pr_write(repo):
        current_payload = store.load_segment(repo, "pr") or {}
        if current_payload != payload:
            logger.info("PR details superseded repo=%s pr=%s", repo, anchor)
            return True
        # Preserve the authoritative association; a recent list can include a foreign
        # fork using the same branch name, or reflect a concurrent state transition.
        window = [p for p in window if p.source_branch != payload["branch"]]
        if raw:
            window = [PullRequest.from_dict(raw), *window][:PRS_CAP]
        window.sort(key=lambda p: p.number, reverse=True)
        payload.update(prs=[asdict(p) for p in window], merge_readiness=readiness,
                       pending_review_verdicts=pending, pending_review_verdicts_key=key,
                       details_checked_at=base.now())
        store.save_segment(repo, "pr", payload)
    return True


def record_failure(repo: str, purpose: str, exc: Exception) -> None:
    attempt = {"attempted_at": base.now(), "purpose": purpose,
               "error": type(exc).__name__, "message": str(exc)}
    if isinstance(exc, ForgeRateLimited):
        attempt.update(retry_at=exc.retry_at, resource=exc.resource)
    store.save_segment(repo, "pr_observation_attempt", attempt)
    logger.warning("PR observation failed repo=%s purpose=%s error=%s", repo, purpose, exc)


def persist_pr(repo: str, payload: dict) -> None:
    """Publish core facts without replacing a newer observation of the same branch."""
    git_state.ensure_gitignore_excluded(repo)   # keep /.devloop/ out of git if pr.json is first
    with _pr_write(repo):
        previous = store.load_segment(repo, "pr") or {}
        if (previous.get("branch") == payload.get("branch")
                and previous.get("checked_at", 0) > payload.get("checked_at", 0)):
            return
        store.save_segment(repo, "pr", payload)


def refresh_pr(repo: str, *, forge: Forge | None = None, inventory: dict | None = None,
               required: bool = False) -> bool:
    """Poll + persist the `pr` segment in one shot — the authoritative refresh a low-frequency
    gate (gcampr) triggers so it decides on LIVE PR state, not a possibly-stale monitor cache.
    (The old `refresh_pr_state` polled and DISCARDED the result — a silent no-op.) Best-effort;
    returns whether anything was written."""
    payload = poll_pr(repo, forge=forge, inventory=inventory, required=required)
    if payload is None:
        return False
    persist_pr(repo, payload)
    return True


# ── local_pull_requests.json (all local branches joined to forge state) ──────
def _checkout_kind(main: Path | None, path: Path) -> str:
    if path == main:
        return "primary"
    if main is not None and path.parent in {main / ".worktrees", main / "worktrees"}:
        return "managed"
    return "external"


def poll_local_pull_requests(repo: str, *, forge: Forge | None = None) -> dict | None:
    """Join complete local/open inventories with bounded, independently dated history.

    +spec=`Failed remote reads preserve the previous snapshot. Historical entries keep
    their own verification times; unknown history and absent open PRs never prove termination.`
    +link=component://docs/pr-observation.md
    """
    forge = forge if forge is not None else forge_for_repo(repo)
    if forge is None:
        return None
    try:
        branches = git_state.list_local_branches(repo)
        checkouts = git_state.list_checkouts(repo)
    except OSError as exc:
        record_failure(repo, "inventory", exc)
        return None
    # A located Git directory does not locate its checkout. Keep the whole
    # inventory unknown so reconciliation cannot read that gap as reclaimed.
    if any(entry.branch and entry.path is None for entry in checkouts):
        record_failure(repo, "inventory", ForgeError("checkout location is unknown"))
        return None
    main = next((Path(entry.path) for entry in checkouts if entry.primary and entry.path), None)
    checkout_by_branch = {
        entry.branch: {
            "path": entry.path,
            "kind": _checkout_kind(main, Path(entry.path)),
        }
        for entry in checkouts
        if entry.branch and entry.path is not None
    }

    try:
        observed_at = base.now()
        previous = store.load_segment(repo, "local_pull_requests") or {}
        by_branch = {r["branch"]: r for r in previous.get("branches", [])}
        open_by_branch: dict[str, list[PullRequest]] = {}
        for pr in forge.open_pull_requests():
            open_by_branch.setdefault(pr.source_branch, []).append(pr)
        # Cold history is bounded, oldest first, so retained refs cannot monopolize polling.
        due = sorted((branch for branch, _ in branches
                      if branch not in open_by_branch
                      and base.is_stale(by_branch.get(branch, {}).get("history_checked_at"), HISTORY_INTERVAL)),
                     key=lambda b: by_branch.get(b, {}).get("history_checked_at", 0))[:HISTORY_BATCH]
        local_branches = []
        for branch, head in branches:
            old = by_branch.get(branch, {})
            old_pr = PullRequest.from_dict(old["pull_request"]) if old.get("pull_request") else None
            checkout = checkout_by_branch.get(branch)
            history_at = old.get("history_checked_at", 0)
            checked_at = old.get("checked_at", 0)
            pr = old_pr
            if branch in open_by_branch:
                pr = pick_branch_pr(open_by_branch[branch], repo, head)
                checked_at = observed_at
            else:
                vanished = old_pr is not None and old_pr.is_open
                if vanished:
                    # Absence from the open list is not proof of a terminal state.
                    pr = forge.get(old_pr.number)
                    checked_at = observed_at
                changed = bool(old) and (old.get("head_sha") != head or old.get("checkout") != checkout)
                if branch in due or changed or (checkout and checkout["kind"] != "primary"):
                    pr = pick_branch_pr(forge.prs_for_branch(branch), repo, head)
                    history_at = checked_at = observed_at
            local_branches.append({
                "branch": branch, "head_sha": head, "checkout": checkout,
                "pull_request": asdict(pr) if pr else None,
                "checked_at": checked_at, "history_checked_at": history_at,
                "observation": "known" if checked_at else "unknown",
            })
    except (ForgeError, OSError) as exc:
        record_failure(repo, "inventory", exc)
        return None
    return {
        "fetched_at": observed_at,
        "provider": forge.provider,
        "branches": local_branches,
        "changes": [],
        "actions": [],
    }


def persist_local_pull_requests(repo: str, payload: dict) -> None:
    """Write the monitor-owned local branch ↔ PR/MR inventory."""
    git_state.ensure_gitignore_excluded(repo)
    store.save_segment(repo, "local_pull_requests", payload)


def refresh_local_pull_requests(repo: str, *, forge: Forge | None = None) -> bool:
    """Poll + persist the complete local branch inventory, best-effort."""
    previous = store.load_segment(repo, "local_pull_requests") or {}
    payload = poll_local_pull_requests(repo, forge=forge)
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

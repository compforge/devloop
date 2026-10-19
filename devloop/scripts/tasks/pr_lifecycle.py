"""One PR/MR observation and local-resource reconciliation task.

The task is deliberately one-shot. Claude's monitor adapter repeats it in a local
process; Codex Scheduled tasks invoke the same task once per scheduled run.
"""
from __future__ import annotations

from pathlib import Path
import fcntl
import hashlib
import json
import logging
import os
import time

from domain import pull_request_lifecycle, repo_layout, workspace, worktree
from domain.context import WorkspaceContext, prstate, store
from tasks.registry import discover

logger = logging.getLogger(__name__)
IDLE_INTERVAL = 3600


def _local_identity(repo: str) -> str:
    branches = prstate.git_state.list_local_branches(repo)
    checkouts = prstate.git_state.list_checkouts(repo)
    return hashlib.sha256(json.dumps([branches, [(c.path, c.branch) for c in checkouts]],
                                     sort_keys=True).encode()).hexdigest()


def sweep_repo(repo: str, *, force: bool = False) -> dict:
    """All adapters share one process lease and cadence per repository.

    +spec=`Check due time inside the execution lease; skipped and failed runs do not
    renew successful observation timestamps or authorize checkout removal.`
    """
    control = worktree.primary(repo)
    home = store.tmp_dir(control)
    home.mkdir(parents=True, exist_ok=True)
    fd = os.open(home / "pr-observation.lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"repo": repo, "skipped": "running", "actions": []}
        attempt = store.load_segment(control, "pr_task_attempt") or {}
        identity = _local_identity(control)
        if not force and identity == attempt.get("local_identity") and time.time() < attempt.get("next_attempt_at", 0):
            return {"repo": repo, "skipped": "not_due", "actions": []}
        started = time.time()
        report = _sweep_repo(control)
        interval = discover()["pr-lifecycle-reconcile"].interval_seconds
        inventory = store.load_segment(control, "local_pull_requests") or {}
        if report.get("updated", {}).get("local_pull_requests") and not any(
            (row.get("pull_request") or {}).get("state") == "open"
            or (row.get("checkout") or {}).get("kind") in {"managed", "external"}
            or (row.get("checkout") and not prstate.git_state.is_protected_branch(row["branch"]))
            or row.get("observation") == "unknown"
            for row in inventory.get("branches", [])
        ):
            interval = IDLE_INTERVAL
        failure = store.load_segment(control, "pr_observation_attempt") or {}
        if failure.get("attempted_at", 0) >= started:
            report["observation_error"] = failure
        next_at = max(time.time() + interval, failure.get("retry_at", 0))
        store.save_segment(control, "pr_task_attempt", {"attempted_at": started,
                           "next_attempt_at": next_at, "local_identity": identity})
        logger.info("PR observation repo=%s report=%s", control, json.dumps(report))
        return report
    finally:
        os.close(fd)


def _sweep_repo(repo: str) -> dict:
    """Refresh one repo, reconcile it, and return a compact execution report."""
    control_repo = worktree.primary(repo)
    forge = prstate.forge_for_repo(repo)
    counts = forge.request_counts() if forge else {}
    by_purpose = {}

    def record_requests(purpose: str) -> None:
        nonlocal counts
        current = forge.request_counts() if forge else {}
        by_purpose[purpose] = {key: value - counts.get(key, 0) for key, value in current.items()}
        counts = current

    inventory_updated = prstate.refresh_local_pull_requests(repo, forge=forge)
    record_requests("inventory")
    current_updated = False
    details_updated = False
    if inventory_updated:
        inventory = store.load_segment(control_repo, "local_pull_requests")
        current_updated = prstate.refresh_pr(repo, forge=forge, inventory=inventory)
        record_requests("current")
        pull_request_lifecycle.reconcile(repo, forge=forge)
        record_requests("lifecycle")
        if current_updated:
            details_updated = prstate.refresh_pr_details(repo, forge)
            record_requests("details")
    remote_updated = prstate.refresh_remote_branches(control_repo)
    inventory = store.load_segment(control_repo, "local_pull_requests") or {}
    pull_requests = []
    for local_branch in inventory.get("branches") or []:
        pr = local_branch.get("pull_request") or {}
        if not pr:
            continue
        checkout = local_branch.get("checkout") or {}
        pull_requests.append({
            "branch": local_branch.get("branch") or "",
            "number": pr.get("number"),
            "state": pr.get("state") or "",
            "checkout": checkout.get("kind"),
        })
    return {
        "repo": repo,
        "updated": {
            "current_pull_request": current_updated,
            "local_pull_requests": inventory_updated,
            "remote_branches": remote_updated,
            "pull_request_details": details_updated,
        },
        "pull_requests": pull_requests,
        "changes": (inventory.get("changes") or []) if inventory_updated else [],
        "actions": (inventory.get("actions") or []) if inventory_updated else [],
        "http": forge.request_counts() if forge else {},
        "http_by_purpose": by_purpose,
    }


def repos_for_target(target: str) -> list[str]:
    """Resolve the repos covered by one task target.

    A registered workspace means every subproject; otherwise the target's containing
    repository is the complete scope. Discovery is repeated on every run so both monitor
    adapters see newly added workspace repositories.
    """
    ws = workspace.find_containing_workspace(target)
    if ws:
        ctx = WorkspaceContext.load(ws) or WorkspaceContext.refresh(ws)
        repos: list[str] = []
        for subproject in ctx.subprojects:
            root = repo_layout.find_git_root(
                str((Path(ws) / (subproject.path or subproject.name)).resolve())
            )
            if root and root not in repos:
                repos.append(root)
        if repos:
            return repos
    root = repo_layout.find_git_root(target)
    return [root] if root else []


def run(target: str, *, repo_only: bool = False) -> list[dict]:
    """Run one fault-isolated sweep over every repository in scope."""
    results = []
    repos = [repo_layout.find_git_root(target)] if repo_only else repos_for_target(target)
    for repo in filter(None, repos):
        try:
            results.append(sweep_repo(repo))
        except Exception as exc:
            results.append({"repo": repo, "error": type(exc).__name__})
    return results

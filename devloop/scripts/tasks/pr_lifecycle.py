"""One PR/MR observation and local-resource reconciliation task.

The task is deliberately one-shot. Claude's monitor adapter repeats it in a local
process; Codex Scheduled tasks invoke the same task once per scheduled run.
"""
from __future__ import annotations

from pathlib import Path
from dataclasses import asdict
from lib.forge import pr_context_for_repo
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
        if not report.get("errors") and not report.get("has_linked_checkouts") and all(row["observation"] == "known" for row in report.get("associations", [])) and not any(pr["state"] == "open" or pr.get("checkout") for pr in report.get("pull_requests", [])):
            interval = IDLE_INTERVAL
        next_at = time.time() + interval
        store.save_segment(control, "pr_task_attempt", {"attempted_at": started,
                           "next_attempt_at": next_at, "local_identity": identity})
        logger.info("PR observation repo=%s report=%s", control, json.dumps(report))
        return report
    finally:
        os.close(fd)


def _sweep_repo(repo: str) -> dict:
    """Refresh one repo, reconcile it, and return a compact execution report."""
    context = pr_context_for_repo(repo)
    if context is None:
        return {"repo": repo, "errors": ["no usable forge"], "actions": [], "pull_requests": []}
    try:
        issues = list(context.observer.maintain())
        inventory = prstate.inventory_view(context)
        actions = pull_request_lifecycle.reconcile(repo, context=context, inventory=inventory)
        rows = inventory["branches"]
        issues.extend(row["error"] for row in rows if row.get("error"))
        return {"repo": repo, "errors": issues,
                "has_linked_checkouts": any(row.get("checkout") and row["checkout"]["kind"] != "primary" for row in rows),
                "pull_requests": [{"branch": row["branch"], "number": row["pull_request"]["number"],
                                   "state": row["pull_request"]["state"], "checkout": row.get("checkout")}
                                  for row in rows if row.get("pull_request")],
                "associations": [{"branch": row["branch"], "observation": row["observation"]} for row in rows],
                "actions": [asdict(action) for action in actions],
                "updated": {"remote_branches": prstate.refresh_remote_branches(repo)},
                "http": context.observer.reader.request_counts()}
    finally:
        context.observer.close()


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

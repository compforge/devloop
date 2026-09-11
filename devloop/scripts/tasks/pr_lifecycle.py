"""One PR/MR observation and local-resource reconciliation task.

The task is deliberately one-shot. Claude's monitor adapter repeats it in a local
process; Codex Scheduled tasks invoke the same task once per scheduled run.
"""
from __future__ import annotations

from pathlib import Path

from domain import pull_request_lifecycle, repo_layout, workspace, worktree
from domain.context import WorkspaceContext, prstate, store


def sweep_repo(repo: str) -> dict:
    """Refresh one repo, reconcile it, and return a compact execution report."""
    control_repo = worktree.primary(repo)
    current_updated = prstate.refresh_pr(repo)
    inventory_updated = prstate.refresh_local_pull_requests(repo)
    if inventory_updated:
        pull_request_lifecycle.reconcile(repo)
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
        },
        "pull_requests": pull_requests,
        "changes": (inventory.get("changes") or []) if inventory_updated else [],
        "actions": (inventory.get("actions") or []) if inventory_updated else [],
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


def run(target: str) -> list[dict]:
    """Run one fault-isolated sweep over every repository in scope."""
    results = []
    for repo in repos_for_target(target):
        try:
            results.append(sweep_repo(repo))
        except Exception as exc:
            results.append({"repo": repo, "error": type(exc).__name__})
    return results

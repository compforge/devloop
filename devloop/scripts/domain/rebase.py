"""Development policy over RepoCLI's recoverable Git rebase operation."""
from __future__ import annotations

import logging
import subprocess

from repokit.cli import rebase_result
from repokit.cli import run as run_repocli

from .context import RepoContext, gate, session

logger = logging.getLogger(__name__)


class RebaseError(Exception):
    """The development workflow cannot safely advance."""


def _owner(repo: str) -> None:
    identity = session.current_identity()
    if session.foreign_owner(repo, identity.session_id, harness=identity.harness):
        raise RebaseError("checkout belongs to another active session")


def _view(repo: str):
    _owner(repo)
    view = gate.evaluate(repo)
    if not view.branch:
        raise RebaseError("current checkout is detached; select the source branch")
    if view.protected():
        raise RebaseError(f"refusing to rewrite protected branch {view.branch!r}")
    if view.inactive():
        raise RebaseError(f"refusing to rewrite {view.branch!r}: its PR/MR is merged or closed")
    return view


def _invoke(repo: str, action: str, arguments: list[str] | None = None, *, branch: str | None = None,
            target: str | None = None) -> list[str]:
    """+spec=Only confirmed matching CLI facts advance the workflow; no SDK mutation fallback or local recovery record.

    +link=component://devloop/docs/repository-toolkit.md
    """
    try:
        envelope = run_repocli(repo, ("git", "rebase", action), arguments or [], timeout=300)
        if envelope["outcome"] != "succeeded":
            error = envelope.get("error")
            message = error.get("message") if isinstance(error, dict) else None
            raise RebaseError(f"rebase {action} {envelope['outcome']}: {message or 'inspect the CLI result before retrying'}")
        data = rebase_result(envelope, repo, action, branch=branch, target=target)
        phase = data["phase"]
        plan = [f"rebase phase={phase}"]
        plan.extend(f"conflict: {path}" for path in data["conflicts"])
        for diagnostic in data["diagnostics"]:
            if not isinstance(diagnostic, dict) or not isinstance(diagnostic.get("message"), str):
                raise ValueError("invalid rebase diagnostic")
            plan.append(f"warning: {diagnostic['message']}")
        if phase == "paused":
            plan.append("resolve and stage conflicts, then run smart_rebase.sh continue")
        elif phase == "ready":
            plan.append("validate the resulting tree, then run smart_rebase.sh finish")
        if action != "status":
            try:
                RepoContext.refresh_branch(repo)
            except (OSError, ValueError) as error:
                logger.warning("Rebase confirmed but devloop context refresh failed repo=%s phase=%s", repo, phase)
                plan.append(f"warning: context refresh failed: {error}")
        return plan
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise RebaseError(f"rebase {action} result unavailable; inspect repocli git rebase status before retrying: {error}") from error


def start(repo: str, target: str | None = None) -> list[str]:
    view = _view(repo)
    pr_target = view.active_pr.target_branch if view.active_pr else ""
    if target and pr_target and target != pr_target:
        raise RebaseError(f"--target {target!r} differs from the open PR/MR target {pr_target!r}")
    selected = target or pr_target or view.target
    return _invoke(repo, "start", ["--branch", view.branch, "--target", selected],
                   branch=view.branch, target=selected)


def continue_rebase(repo: str) -> list[str]:
    # Git is detached while replaying commits; RepoCLI verifies its saved/native identity.
    _owner(repo)
    return _invoke(repo, "continue")


def finish(repo: str) -> list[str]:
    view = _view(repo)
    return _invoke(repo, "finish", branch=view.branch)


def abort(repo: str) -> list[str]:
    _owner(repo)
    return _invoke(repo, "abort")


def status(repo: str) -> list[str]:
    return _invoke(repo, "status")

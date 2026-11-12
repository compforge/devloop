"""Development branch policy over RepoCLI's data-preserving branch operation."""
from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
import subprocess

from command import run_repocli
from repokit.git import state as git_state
from .context import RepoContext, session

logger = logging.getLogger(__name__)


class BranchError(RuntimeError):
    pass


@dataclass(frozen=True)
class CreateResult:
    name: str
    base: str
    created: bool
    carried_changes: bool
    fork_from: str | None
    stash_oid: str | None = None


def create(repo: str, name: str, base: str, *, carry_changes: bool = False,
           identity: session.SessionIdentity | None = None) -> CreateResult:
    """+spec=RepoCLI owns Git writes and recovery. Confirmed branch identity advances devloop context even when restoring changes fails.

    +link=component://devloop/docs/repository-toolkit.md
    """
    ident = identity or session.current_identity()
    previous = session.read(repo, ident.harness) if ident.session_id else None
    already_mine = bool(previous and previous.get("session_id") == ident.session_id)
    current = git_state.get_current_branch(repo)
    if not session.acquire(repo, ident.session_id, current or "", harness=ident.harness):
        raise _owner_error(repo, ident)
    target = base.removeprefix("origin/")
    arguments = [name, "--base", target]
    if base.startswith("origin/"):
        arguments += ["--remote", "origin"]
    if carry_changes:
        arguments.append("--carry-changes")
    try:
        envelope = run_repocli(repo, ("git", "branch", "create"), arguments, timeout=300)
        data = envelope.get("data")
        if (not isinstance(data, dict) or data.get("branch") != name
                or not isinstance(data.get("checkout"), str)
                or Path(data["checkout"]).resolve() != Path(repo).resolve()
                or not all(isinstance(data.get(k), bool) for k in
                           ("branchConfirmed", "changesRestored", "confirmed", "writeAttempted"))
                or not isinstance(data.get("currentBranch"), str)
                or not isinstance(data.get("phase"), str)
                or not isinstance(data.get("stashOid", ""), str)
                or not isinstance(data.get("diagnostics"), list)
                or not all(isinstance(d, dict) and isinstance(d.get("message"), str)
                           for d in data["diagnostics"])
                or not isinstance(envelope.get("error") or {}, dict)):
            raise ValueError("invalid branch operation report")
        switched = data["branchConfirmed"]
        if switched and data["currentBranch"] != name:
            raise ValueError("confirmed branch contradicts checkout identity")
        if envelope["outcome"] == "succeeded" and (not data["confirmed"] or not switched
                or not data["changesRestored"] or data.get("action") not in {"created", "reused"}):
            raise ValueError("successful command lacks confirmed branch creation and change restoration")
        created = data.get("action") == "created"
        fork_from = target if created else None
        if switched:
            # Git has switched even if apply failed; keep owner/context on the new branch.
            # A projection failure does not undo confirmed Git effects or authorize replay.
            try:
                ctx = RepoContext.refresh_branch(repo)
                if created:
                    ctx.set_fork_from(target)
            except (OSError, ValueError) as error:
                logger.warning("Branch confirmed but context refresh failed repo=%s branch=%s error=%s", repo, name, error)
            try:
                if not session.acquire(repo, ident.session_id, name, harness=ident.harness):
                    logger.warning("Branch confirmed but owner refresh rejected repo=%s branch=%s", repo, name)
            except (OSError, ValueError) as error:
                logger.warning("Branch confirmed but owner refresh failed repo=%s branch=%s error=%s", repo, name, error)
        for diagnostic in data["diagnostics"]:
            logger.warning("Branch operation warning repo=%s branch=%s: %s", repo, name, diagnostic["message"])
        if envelope["outcome"] != "succeeded":
            # Release only a known unchanged checkout. Unknown/partial writes retain ownership.
            if (not switched and envelope["outcome"] != "unknown" and not already_mine
                    and (not data["writeAttempted"] or data["phase"] == "failed")):
                session.release(repo, ident.session_id, harness=ident.harness)
            problem = envelope.get("error") or {}
            message = problem.get("message", "inspect the CLI result before retrying")
            backup = f" Recovery stash retained: {data['stashOid']}." if data.get("stashOid") else ""
            record = f" Recovery record: {data['recoveryPath']}." if data.get("recoveryPath") else ""
            raise BranchError(f"branch create {envelope['outcome']}: {message}.{backup}{record}")
        return CreateResult(name=name, base=base, created=created,
                            carried_changes=created and bool(data.get("stashOid")),
                            fork_from=fork_from, stash_oid=data.get("stashOid") or None)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise BranchError(
            f"branch create result unavailable; inspect repocli git branch status {name!r} before retrying: {error}"
        ) from error


def _owner_error(repo: str, identity: session.SessionIdentity) -> BranchError:
    owner = session.foreign_owner(repo, identity.session_id, harness=identity.harness) or {}
    branch = owner.get("branch") or "?"
    sid = str(owner.get("session_id") or "")[:8]
    return BranchError(
        f"checkout is owned by another {identity.harness} session "
        f"(branch {branch!r}, session {sid}…); create a managed worktree with "
        "<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>"
    )

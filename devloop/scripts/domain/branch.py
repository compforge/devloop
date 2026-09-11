"""Branch lifecycle operations shared by start-work and commit workflows."""
from __future__ import annotations

from dataclasses import dataclass

from lib import git_state, gitcmd

from .context import RepoContext, session


class BranchError(RuntimeError):
    pass


@dataclass(frozen=True)
class CreateResult:
    name: str
    base: str
    created: bool
    carried_changes: bool
    fork_from: str | None


def create(
    repo: str,
    name: str,
    base: str,
    *,
    carry_changes: bool = False,
    identity: session.SessionIdentity | None = None,
) -> CreateResult:
    """Create ``name`` from ``base`` and make it the current development branch.

    New work starts from a clean checkout by default. ``carry_changes`` is an explicit
    compatibility path for commit flows that historically allowed edit-then-cut. The
    operation refreshes remote bases, respects checkout ownership, preserves both tracked
    and untracked changes when requested, and records the exact fork point.
    """
    if not name:
        raise BranchError("branch name is required")
    valid = gitcmd.git(repo, "check-ref-format", "--branch", name)
    if not valid.ok:
        raise BranchError(f"invalid branch name {name!r}: {valid.err or valid.out}")

    current = git_state.get_current_branch(repo)
    ident = identity or session.current_identity()
    if current == name:
        if not session.acquire(repo, ident.session_id, name, harness=ident.harness):
            raise _owner_error(repo, ident)
        return CreateResult(name=name, base=base, created=False, carried_changes=False, fork_from=None)
    if git_state.rev_parse(repo, f"refs/heads/{name}"):
        raise BranchError(
            f"local branch {name!r} already exists; resume it explicitly instead of recreating it"
        )

    status = git_state.get_workspace_status(repo)
    if status["dirty"] and not carry_changes:
        raise BranchError(
            "working tree is dirty "
            f"({status['modified_count']} modified, {status['untracked_count']} untracked); "
            "start new work from a clean checkout, use a managed worktree, or pass "
            "--carry-changes when these changes intentionally belong to the new branch"
        )

    if base.startswith("origin/"):
        target = base.split("/", 1)[1]
        refspec = f"+refs/heads/{target}:refs/remotes/origin/{target}"
        if not git_state.fetch(repo, refspec, timeout=30):
            raise BranchError(
                f"could not refresh {base}; branch was not created because its base may be stale"
            )
        if not git_state.rev_parse(repo, base):
            raise BranchError(f"could not resolve refreshed {base}")
    elif not git_state.rev_parse(repo, base):
        raise BranchError(f"could not resolve branch base {base!r}")

    previous_owner = session.read(repo, ident.harness) if ident.session_id else None
    already_mine = bool(previous_owner and previous_owner.get("session_id") == ident.session_id)
    if not session.acquire(repo, ident.session_id, current or "", harness=ident.harness):
        raise _owner_error(repo, ident)

    stashed = False
    switched = False
    try:
        if status["dirty"]:
            stash = gitcmd.git(repo, "stash", "push", "-u", "-m", f"devloop: cutting {name}")
            if not stash.ok:
                raise BranchError(f"could not preserve local changes before creating {name!r}: {stash.err}")
            stashed = "No local changes" not in (stash.out + stash.err)

        checkout = gitcmd.git(repo, "checkout", "-b", name, base)
        if not checkout.ok:
            if stashed:
                gitcmd.git(repo, "stash", "pop")
            raise BranchError(f"could not cut {name!r} off {base}: {checkout.err or checkout.out}")
        switched = True

        # The checkout has already changed even if stash reapplication conflicts below. Refresh
        # branch identity and ownership at that irreversible boundary so the next turn never sees
        # the old branch in devloop state while resolving the conflict on the new one.
        fork_from = base.split("/", 1)[1] if base.startswith("origin/") else base
        RepoContext.refresh_branch(repo).set_fork_from(fork_from)
        session.acquire(repo, ident.session_id, name, harness=ident.harness)

        if stashed:
            pop = gitcmd.git(repo, "stash", "pop")
            if not pop.ok:
                raise BranchError(
                    f"cut {name!r} off {base} but reapplying local changes conflicted: "
                    f"{pop.err or pop.out}. The changes remain in the working tree and stash; "
                    "resolve the conflicts, then drop the stash."
                )

        return CreateResult(
            name=name,
            base=base,
            created=True,
            carried_changes=stashed,
            fork_from=fork_from,
        )
    except BranchError:
        if ident.session_id and not already_mine and not switched:
            session.release(repo, ident.session_id, harness=ident.harness)
        raise


def _owner_error(repo: str, identity: session.SessionIdentity) -> BranchError:
    owner = session.foreign_owner(repo, identity.session_id, harness=identity.harness) or {}
    branch = owner.get("branch") or "?"
    sid = str(owner.get("session_id") or "")[:8]
    return BranchError(
        f"checkout is owned by another {identity.harness} session "
        f"(branch {branch!r}, session {sid}…); create a managed worktree with "
        "scripts/checkout.py <repo> --worktree <tag>"
    )

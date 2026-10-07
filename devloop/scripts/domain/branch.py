"""Branch lifecycle operations shared by start-work and commit workflows."""
from __future__ import annotations

from dataclasses import dataclass

from repocli import git as operations, stash

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
    stash_oid: str | None = None


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
    if not status["complete"]:
        raise BranchError("cannot inspect working tree; branch was not created")
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

    stash_oid: str | None = None
    switched = False
    uncertain = False
    try:
        if status["dirty"]:
            saved = stash.save(repo, include_untracked=True, message=f"devloop: cutting {name}")
            stash_oid = saved.oid
            uncertain = saved.result.uncertain
            if not saved.result.ok:
                raise BranchError(f"could not preserve local changes before creating {name!r}: {gitcmd.operation_detail(saved.result)}")

        checkout = operations.create_branch(repo, name, base)
        uncertain = checkout.uncertain
        if not checkout.ok:
            if stash_oid and not uncertain:
                restored = stash.restore(repo, stash_oid)
                uncertain = restored.uncertain
                if not restored.ok:
                    raise BranchError(
                        f"could not cut {name!r} off {base}: {gitcmd.operation_detail(checkout)}; "
                        f"restoring stash {stash_oid} also failed: {gitcmd.operation_detail(restored)}"
                    )
            raise BranchError(f"could not cut {name!r} off {base}: {gitcmd.operation_detail(checkout)}")
        switched = True

        # The checkout has already changed even if stash reapplication conflicts below. Refresh
        # branch identity and ownership at that irreversible boundary so the next turn never sees
        # the old branch in devloop state while resolving the conflict on the new one.
        fork_from = base.split("/", 1)[1] if base.startswith("origin/") else base
        RepoContext.refresh_branch(repo).set_fork_from(fork_from)
        session.acquire(repo, ident.session_id, name, harness=ident.harness)

        if stash_oid:
            restored = stash.restore(repo, stash_oid)
            if restored.uncertain:
                raise BranchError(gitcmd.operation_detail(restored))
            if not restored.ok:
                raise BranchError(
                    f"cut {name!r} off {base} but reapplying local changes failed: "
                    f"{restored.err or restored.out}. Recovery stash retained: {stash_oid}; "
                    "inspect the index and working tree before retrying."
                )

        return CreateResult(
            name=name,
            base=base,
            created=True,
            carried_changes=stash_oid is not None,
            stash_oid=stash_oid,
            fork_from=fork_from,
        )
    except BranchError:
        if ident.session_id and not already_mine and not switched and not uncertain:
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

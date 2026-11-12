"""Decision-time Git identity and library-owned PR queries for workflow gates."""
from __future__ import annotations
from domain import git_policy

from dataclasses import dataclass

from repokit import state as repository_state
from repokit.git import state as git_state
from . import prstate
from .base import PullRequest


@dataclass(frozen=True)
class GateView:
    """Authoritative, decision-time facts for one repo. Built by `evaluate()`; the fields are
    LIVE git reads, `active_pr` is the repocli query result validated against live HEAD."""
    git_root: str
    branch: str | None        # LIVE current branch (None on detached HEAD)
    head_sha: str             # LIVE HEAD sha
    target: str               # RepoKit default branch, otherwise the workflow fallback
    provider: str
    active_pr: PullRequest | None

    def protected(self) -> bool:
        return git_policy.is_protected_branch(self.branch)

    def inactive(self) -> bool:
        """The current branch's PR/MR is merged/closed — block edits / refuse to continue."""
        return bool(self.active_pr and self.active_pr.inactive)

    def in_flight(self) -> bool:
        """The current branch's PR/MR is open / awaiting human merge."""
        return bool(self.active_pr and self.active_pr.is_open)


def evaluate(git_root: str) -> GateView:
    """Unavailable and ambiguous PR queries cannot authorize a workflow decision."""
    branch = git_state.get_current_branch(git_root)
    head = git_state.get_head_sha(git_root)
    provider, association = prstate.checkout_pr(git_root, required=True)
    active_pr = association.selected if association else None
    # RepoKit owns default-branch observations; devloop only chooses the unknown-target fallback.
    target = repository_state.default_branch(git_root).branch or git_policy.local_default_target(git_root)

    if git_state.get_current_branch(git_root) != branch or git_state.get_head_sha(git_root) != head:
        raise OSError("checkout changed during PR decision")

    return GateView(
        git_root=str(git_root),
        branch=branch,
        head_sha=head,
        target=target,
        provider=provider,
        active_pr=active_pr,
    )

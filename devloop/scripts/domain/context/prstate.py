"""Transient workflow views over RepoKit PR queries."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from repokit import forge_client, pull_request_context
from repokit.forge import BranchPullRequests

from domain import config
from domain.forge import Forge, ForgeError, PullRequest

logger = logging.getLogger(__name__)


def checkout_pr(repo: str, *, forge: Forge | None = None, required: bool = False) -> tuple[str, BranchPullRequests | None]:
    """Query native associations; workflow gates reject unavailable or ambiguous results."""
    context = None
    provider = ""
    try:
        context = pr_context_for_repo(repo, forge=forge)
        if context is None:
            return "", None
        provider = context.observer.reader.provider
        current = context.get_checkout()
        if current and (current.error or current.ambiguous):
            raise ForgeError(current.error or "multiple PRs match this branch; select a proposal explicitly")
        return provider, current
    except (ForgeError, OSError) as exc:
        if required:
            raise
        logger.warning("PR view unavailable repo=%s error=%s", repo, exc)
        return provider, None
    finally:
        if context is not None:
            context.observer.close()


@dataclass
class ReviewDetails:
    pending: int | None = None
    pending_key: str = ""
    readiness: str | None = None


def review_details(repo: str, pr: PullRequest | None) -> ReviewDetails:
    """Read workflow review facts only when projecting an open proposal onto Board."""
    from domain import review_feedback
    result = ReviewDetails()
    if pr is None or not pr.is_open:
        return result
    try:
        forge = forge_client(repo)
    except ForgeError as exc:
        logger.warning("PR review access unavailable repo=%s pr=%s error=%s", repo, pr.number, exc)
        return result
    if forge is None:
        return result
    target = forge.for_repository(pr.target_repository)
    try:
        findings = review_feedback.pending(target.comments(pr.number))
        result.pending = len(findings)
        result.pending_key = review_feedback.pending_key(findings)
    except ForgeError as exc:
        logger.warning("PR review view unavailable repo=%s pr=%s error=%s", repo, pr.number, exc)
    try:
        result.readiness = target.merge_readiness(pr.number).value
    except ForgeError as exc:
        logger.warning("PR readiness unavailable repo=%s pr=%s error=%s", repo, pr.number, exc)
    return result


def pr_context_for_repo(repo_dir: str | Path, *, forge: Forge | None = None):
    """Select the workflow target; RepoKit owns access and branch associations."""
    target = config.pull_request_target(repo_dir)
    return pull_request_context(repo_dir, targets=(target,) if target else None, reader=forge)

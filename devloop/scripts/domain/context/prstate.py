"""Transient workflow views over repocli PR queries; remote trunk tips remain workflow state."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from repokit.forge import BranchPullRequests
from repokit.config import load_config
from repokit.git.remote import remote
from lib import git_state
from lib import config
from lib.forge import forge_client
from domain.forge import Forge, ForgeError, PullRequest
from . import base, store

TRUNK_CANDIDATES = ("main", "master", "release")
logger = logging.getLogger(__name__)


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


def pr_context_for_repo(
    repo_dir: str | Path, *, forge: Forge | None = None, target_repository: str | None = None,
):
    """Select the workflow target; RepoKit owns access and branch associations.

    +spec=`Only an absent Forge origin means PR queries are inapplicable;
    a configured origin without credentials is unavailable, never known to have no PR.`
    +link=`component://docs/pr-observation.md`
    """
    origin = remote(repo_dir)
    if origin is None:
        return None
    try:
        connection = load_config().forge(origin.host)
    except (ValueError, OSError) as error:
        raise ForgeError(str(error)) from error
    # Target selection belongs to the workflow; RepoKit never infers a fork parent.
    target = config.pull_request_target(repo_dir) or origin.path
    if target_repository:
        name, separator, target = target_repository.partition("/")
        if not separator or not target or name != connection.name:
            raise ValueError("target repository must be an ID within the configured Forge")
    return connection.pull_request_context(repo_dir, source=origin.path, targets=(target,), reader=forge)

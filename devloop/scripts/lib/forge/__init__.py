"""Unified forge facade — provider-neutral access to GitHub / GitLab, picked per-repo.

    from lib.forge import forge_for_repo
    from domain.forge import ForgeError
    f = forge_for_repo(repo_dir)              # None if no token / unsupported remote
    if f:
        pr = f.create(source_branch="feat/x", target_branch="main", title="...")

`forge_for_repo` resolves the repo's origin → (provider, host, token) in one place
(`resolve_forge`), then builds the matching adapter. The aggregate-workspace case is
first-class: each repo resolves its own provider, so a GitHub subproject and a GitLab one
coexist. Workflow presentation policy stays in the domain layer.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .. import config
from repokit.git.remote import remote
from domain.forge import (
    Comment,
    Forge,
    ForgeAuthError,
    ForgeError,
    ForgeNotFound,
    MergeReadiness,
    PullRequest,
    PullRequestIdentity,
    Release,
    parse_pr_number,
    pr_label,
    vocab,
)
from repokit.forge import ForgeConnection, detect_provider as detect_provider


def parse_origin(repo_dir: str | Path) -> tuple[str, str] | None:
    """Configured Git identity; provider and credential policy stay in devloop."""
    observed = remote(repo_dir)
    return (observed.host, observed.path) if observed else None


@dataclass(frozen=True)
class ForgeResolution:
    """The repo's forge identity, resolved ONCE from the three sources (origin remote /
    config / env). `token` is None when no usable credential exists."""
    provider: str
    host: str        # host parsed from origin (the config key)
    api_host: str    # host to hit for the API (config `api_host` override, else `host`)
    path: str        # owner/repo (GitHub) or group/subgroup/proj (GitLab)
    token: str | None

    def pull_request_identity(self, number: int) -> PullRequestIdentity:
        return PullRequestIdentity(
            source=self.host,
            repository=self.path,
            number=number,
        )


def resolve_forge(repo_dir: str | Path) -> ForgeResolution | None:
    """origin + config + env → one ForgeResolution. None if origin is unresolvable.

    Single place the three sources are combined, so call sites never re-derive provider /
    host / token piecemeal.
    """
    parsed = parse_origin(repo_dir)
    if parsed is None:
        return None
    host, path = parsed
    entry = config.forge_entry(host, repo_dir)
    provider = detect_provider(host, entry.get("type"))
    return ForgeResolution(
        provider=provider,
        host=host,
        api_host=entry.get("api_host") or host,
        path=path,
        token=config.forge_token(host, provider, repo_dir),
    )


def forge_for_repo(repo_dir: str | Path, *, timeout: int = 10) -> Forge | None:
    """Build the forge adapter for this repo's origin. None if the remote is unresolvable
    or no token is available (callers skip quietly — forge features are best-effort)."""
    r = resolve_forge(repo_dir)
    if r is None or not r.token:
        return None
    return _connection(r, timeout=timeout).client(r.path)


def _connection(resolution: ForgeResolution, *, timeout: int = 10) -> ForgeConnection:
    return ForgeConnection(host=resolution.host, token=resolution.token or "",
                           provider=detect_provider(resolution.host, resolution.provider),
                           api_host=resolution.api_host, timeout=timeout)


def pr_context_for_repo(repo_dir: str | Path, *, forge: Forge | None = None):
    """Assemble access policy; repocli owns observation and local associations.

    +spec=`Only an absent Forge origin means PR queries are inapplicable;
    a configured origin without credentials is unavailable, never known to have no PR.`
    +link=`component://docs/pr-observation.md`
    """
    r = resolve_forge(repo_dir)
    if r is None:
        return None
    connection = _connection(r)
    # Target selection belongs to the workflow; RepoKit never infers a fork parent.
    target = config.forge_entry(r.host, repo_dir).get("target_repository") or r.path
    return connection.pull_request_context(repo_dir, source=r.path, targets=(target,), reader=forge)

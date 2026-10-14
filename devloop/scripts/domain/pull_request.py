"""Repository endpoints and target baselines for the pull-request lifecycle."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from domain.forge import Forge, ForgeError
from lib import git_state, gitcmd
from lib.forge import forge_for_repo, resolve_forge
from repocli.remote import remote

logger = logging.getLogger(__name__)


def forge_for_pull_requests(repo: str) -> Forge | None:
    """PR numbers belong to the target; branch lookup includes the full source path.

    +spec=`A fork contributes to its direct same-Forge parent; origin remains the push destination`
    +why=`The same branch name and PR number can exist in multiple repositories`
    +link=`component://docs/repository-toolkit.md`
    """
    source = forge_for_repo(repo)
    if source is None:
        return None
    repository = source.repository()
    target = repository.forked_from or repository.path
    return source.for_repository(target, source_repository=repository.path)


@dataclass(frozen=True)
class TargetBase:
    """The target branch and its local comparison ref; independent of the push remote."""
    branch: str
    remote: str
    ref: str

    def refresh(self, repo: str) -> None:
        destination = f"refs/remotes/{self.ref}" if self.ref.startswith("origin/") else self.ref
        kwargs = {} if self.remote == "origin" else {"remote": self.remote}
        if not git_state.fetch(repo, f"+refs/heads/{self.branch}:{destination}", timeout=30, **kwargs):
            raise ForgeError(f"could not refresh target {self.remote} branch {self.branch}")
        if not git_state.rev_parse(repo, self.ref):
            raise ForgeError(f"could not resolve refreshed target {self.ref}")
        logger.info("PR target refreshed: remote=%s branch=%s ref=%s", self.remote, self.branch, self.ref)


def target_base(repo: str, branch: str | None = None) -> TargetBase:
    source = forge_for_repo(repo)
    if source is None:
        selected = branch or git_state.local_default_target(repo)
        return TargetBase(selected, "origin", f"origin/{selected}")
    repository = source.repository()
    path = repository.forked_from or repository.path
    target = source.for_repository(path)
    selected = branch or target.default_branch()
    if not selected:
        raise ForgeError(f"target repository {path} has no default branch")
    valid = gitcmd.git(repo, "check-ref-format", "--branch", selected)
    if not valid.ok:
        raise ForgeError(f"invalid target branch {selected!r}")
    if path == repository.path:
        return TargetBase(selected, "origin", f"origin/{selected}")
    resolution = resolve_forge(repo)
    if resolution is None:
        raise ForgeError("origin disappeared while resolving the PR target")
    # Reuse an explicitly configured transport when it identifies this exact repository.
    names = gitcmd.git(repo, "remote")
    if not names.ok:
        raise ForgeError(f"cannot list Git remotes: {names.err}")
    transport = f"https://{resolution.host}/{path}.git"
    for name in names.out.splitlines():
        identity = remote(repo, name)
        if identity and (identity.host, identity.path) == (resolution.host, path):
            transport = name
            break
    return TargetBase(selected, transport, f"refs/devloop/targets/{resolution.host}/{path}/{selected}")

"""Repository endpoints and target baselines for the pull-request lifecycle."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from domain.forge import Forge, ForgeError
from lib import git_state, gitcmd
from lib.forge import forge_for_repo, resolve_forge
from repocli.remote import remote

logger = logging.getLogger(__name__)


def target_selection(repo: str, target_repo: str | None = None, *, branch: str | None = None) -> str:
    """Explicit choice, then this branch's recorded target, then the current repository."""
    if target_repo is not None:
        return target_repo
    branch = branch if branch is not None else git_state.get_current_branch(repo)
    if not branch:
        return "current"
    result = gitcmd.git(repo, "config", "--local", "--get", f"branch.{branch}.devloop-target-repo")
    if result.ok:
        return result.out.strip() or "current"
    if result.rc != 1:
        raise ForgeError(f"cannot read PR target for branch {branch}: {result.err}")
    return "current"


def remember_target(repo: str, branch: str, repository: str) -> None:
    """Keep contribution intent in branch-local Git config, outside disposable state caches."""
    result = gitcmd.git(repo, "config", "--local", f"branch.{branch}.devloop-target-repo", repository)
    if not result.ok:
        raise ForgeError(f"cannot record PR target for branch {branch}: {result.err}")
    logger.info("PR target selected: branch=%s repository=%s", branch, repository)


def _target_path(source: Forge, selection: str) -> str:
    if selection == "current":
        return source.source_repository
    if selection == "parent":
        repository = source.repository()
        if not repository.forked_from:
            raise ForgeError("--target-repo parent requires a direct fork parent on this Forge")
        return repository.forked_from
    return selection  # Concrete same-Forge path retained for this branch's lifecycle.


def forge_for_pull_requests(
    repo: str, target_repo: str | None = None, *, branch: str | None = None
) -> Forge | None:
    """PR numbers belong to the selected target; origin remains the source repository.

    +spec=`Fork provenance is not contribution intent; a new branch defaults to its current repository`
    +why=`AI selects current or parent from task context; later lifecycle actions retain that selection`
    +link=`component://docs/repository-toolkit.md`
    """
    selection = target_selection(repo, target_repo, branch=branch)
    source = forge_for_repo(repo)
    if source is None:
        if selection != "current":
            raise ForgeError("cannot resolve the selected PR repository without a supported Forge and credentials")
        return None
    if selection == "current":
        return source
    path = _target_path(source, selection)
    return source.for_repository(path, source_repository=source.source_repository)


@dataclass(frozen=True)
class TargetBase:
    """The target branch and its local comparison ref; independent of the push remote."""
    branch: str
    remote: str
    ref: str
    repository: str = "current"

    def refresh(self, repo: str) -> None:
        destination = f"refs/remotes/{self.ref}" if self.ref.startswith("origin/") else self.ref
        kwargs = {} if self.remote == "origin" else {"remote": self.remote}
        if not git_state.fetch(repo, f"+refs/heads/{self.branch}:{destination}", timeout=30, **kwargs):
            raise ForgeError(f"could not refresh target {self.remote} branch {self.branch}")
        if not git_state.rev_parse(repo, self.ref):
            raise ForgeError(f"could not resolve refreshed target {self.ref}")
        logger.info("PR target refreshed: remote=%s branch=%s ref=%s", self.remote, self.branch, self.ref)


def target_base(
    repo: str, branch: str | None = None, *, target_repo: str | None = None,
    source_branch: str | None = None,
) -> TargetBase:
    selection = target_selection(repo, target_repo, branch=source_branch)
    if selection == "current":
        selected = branch or git_state.local_default_target(repo)
        return TargetBase(selected, "origin", f"origin/{selected}")
    source = forge_for_repo(repo)
    if source is None:
        raise ForgeError("cannot resolve the selected PR repository without a supported Forge and credentials")
    path = _target_path(source, selection)
    target = source.for_repository(path)
    selected = branch or target.default_branch()
    if not selected:
        raise ForgeError(f"target repository {path} has no default branch")
    valid = gitcmd.git(repo, "check-ref-format", "--branch", selected)
    if not valid.ok:
        raise ForgeError(f"invalid target branch {selected!r}")
    if path == source.source_repository:
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
    return TargetBase(selected, transport, f"refs/devloop/targets/{resolution.host}/{path}/{selected}", path)

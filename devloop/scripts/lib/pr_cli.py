"""Credential/config adapter for native repocli PR commands; no maintenance policy."""
from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from harness_common import Repository
from repokit.forge import PullRequestKey
from repokit.forge.creation import PullRequestCreation
from domain.forge import Forge, ForgeError, PullRequest
from lib.forge import resolve_forge


def invoke(repo: str, args: list[str], *, target: str) -> dict | list:
    resolution = resolve_forge(repo)
    if resolution is None or not resolution.token:
        raise ForgeError("PR command unavailable: no Forge credential")
    argv = [os.environ.get("DEVLOOP_REPOCLI", "repocli"), "pr", *args,
            "--repo", repo, "--json", "--provider", resolution.provider,
            "--target-repository", target]
    if resolution.api_host != resolution.host:
        host = resolution.api_host
        if "://" not in host:
            suffix = "/api/v3" if resolution.provider == "github" else "/api/v4"
            host = "https://" + host + suffix
        argv += ["--api-host", host]
    env = dict(os.environ)
    env["GH_TOKEN" if resolution.provider == "github" else "GITLAB_TOKEN"] = resolution.token
    try:
        result = subprocess.run(argv, cwd=repo, env=env, capture_output=True, text=True,
                                timeout=135, check=False)
    except (OSError, subprocess.SubprocessError) as exc:
        raise ForgeError(f"repocli PR command unavailable: {exc}") from exc
    if result.returncode:
        raise ForgeError(f"repocli pr {args[0]} failed ({result.returncode}): {result.stderr[-2000:]}")
    try:
        value = json.loads(result.stdout)
    except ValueError as exc:
        raise ForgeError("repocli returned invalid PR JSON") from exc
    if not isinstance(value, (dict, list)):
        raise ForgeError("repocli returned an invalid PR result")
    return value


def _pull_request(value: dict) -> PullRequest:
    try:
        key = value["key"]
        return PullRequest(number=int(key["number"]), title=value["title"], state=value["state"],
                           source_branch=value["sourceBranch"], target_branch=value["targetBranch"],
                           web_url=value["url"], sha=value["headSha"],
                           source_repository=value["sourceRepository"]["path"],
                           target_repository=key["repository"]["path"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ForgeError("repocli returned an invalid PR identity") from exc


class PullRequestCommands:
    def __init__(self, repo: str, forge: Forge, target_repository: str | None = None):
        self.repo, self.forge = repo, forge
        self.source = forge.repository()
        self.target = self.source
        if target_repository:
            name, separator, path = target_repository.partition("/")
            if not separator or not path or name != self.source.forge.name:
                raise ValueError("target repository must be an ID within the configured Forge")
            self.target = Repository(self.source.forge, path)

    def _operation(self, args: list[str]) -> tuple[PullRequest, bool]:
        result = invoke(self.repo, args, target=self.target.path)
        if not isinstance(result, dict) or not isinstance(result.get("pull_request"), dict):
            raise ForgeError("repocli returned an invalid PR operation result")
        # Maintenance is owned by repocli; retain its diagnostics without taking over cleanup.
        for issue in result.get("maintenance", {}).get("errors", []):
            logging.getLogger(__name__).warning("PR maintenance: %s", issue)
        return _pull_request(result["pull_request"]), bool(result.get("created"))

    def ensure_pull_request(self, *, source_branch: str, title: str, body: str = "",
                            target_branch: str | None = None,
                            target_repository: str | None = None) -> PullRequestCreation:
        if target_repository and target_repository != self.target.id():
            raise ValueError("PR destination differs from command scope")
        if target_branch is None:
            rows = invoke(self.repo, ["list", "--state", "open", "--head", source_branch],
                          target=self.target.path)
            if not isinstance(rows, list):
                raise ForgeError("repocli returned an invalid PR list")
            candidates = [row for row in rows if row["sourceRepository"]["path"] == self.source.path]
            if len(candidates) > 1:
                raise ForgeError("multiple open PRs for source branch")
            client = self.forge if self.target == self.source else self.forge.for_repository(self.target.path)
            target_branch = candidates[0]["targetBranch"] if candidates else client.default_branch()
        with tempfile.TemporaryDirectory(prefix="devloop-pr-") as directory:
            path = Path(directory) / "body"
            path.write_text(body)
            pr, created = self._operation(["create", "--head", source_branch, "--base", target_branch,
                                          "--title", title, "--body-file", str(path)])
        return PullRequestCreation(pr, created, self.source, self.target)

    def update(self, key: PullRequestKey, *, title: str | None = None, body: str | None = None,
               target_branch: str | None = None) -> PullRequest:
        if key.repository != self.target:
            raise ValueError("PR target differs from command scope")
        args = ["update", str(key.number)]
        if title is not None:
            args += ["--title", title]
        if target_branch is not None:
            args += ["--base", target_branch]
        with tempfile.TemporaryDirectory(prefix="devloop-pr-") as directory:
            if body is not None:
                path = Path(directory) / "body"
                path.write_text(body)
                args += ["--body-file", str(path)]
            return self._operation(args)[0]

    def close(self, key: PullRequestKey) -> PullRequest:
        if key.repository != self.target:
            raise ValueError("PR target differs from command scope")
        return self._operation(["close", str(key.number)])[0]


def pr_commands_for_repo(repo: str, *, forge: Forge, target_repository: str | None = None) -> PullRequestCommands:
    return PullRequestCommands(repo, forge, target_repository)

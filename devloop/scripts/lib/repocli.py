"""Read-only CLI adapter for repository queries already exposed by repocli.

No credentials, HTTP requests, caches or retries belong here. Native SDK calls
remain only for operations without an equivalent CLI contract.
"""
from __future__ import annotations

import json
import logging
import subprocess

from domain.forge import ForgeError, PullRequest
from .config import pull_request_target


logger = logging.getLogger(__name__)


def _query(repo: str, operation: str, arguments: list[str]) -> object:
    """+spec=Unavailable or malformed CLI results never become verified absence of PRs.

    +link=component://references/repocli.md
    """
    try:
        result = subprocess.run(
            ["repocli", "pr", operation, *arguments, "--repo", repo, "--timeout", "10s", "--json"],
            capture_output=True, text=True, timeout=12,
        )
        envelope = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise ForgeError(f"repocli pr {operation} unavailable: {type(error).__name__}") from error
    if not isinstance(envelope, dict) or envelope.get("schemaVersion") != "1.0" or envelope.get("command") != f"repocli pr {operation}":
        raise ForgeError("Unsupported repocli result contract")
    cost = envelope.get("cost")
    logger.debug("RepoCLI query repo=%s operation=%s outcome=%s wall_seconds=%s",
                 repo, operation, envelope.get("outcome"),
                 cost.get("wallSeconds") if isinstance(cost, dict) else None)
    if result.returncode != 0 or envelope.get("outcome") != "succeeded":
        detail = envelope.get("error")
        if not isinstance(detail, dict):
            detail = {}
        message = detail.get("message") or envelope.get("summary")
        raise ForgeError(message if isinstance(message, str) else "repocli query failed")
    return envelope.get("data")


def _target(repo: str, target: str | None = None) -> list[str]:
    destination = target or pull_request_target(repo)
    return ["--target-repository", destination] if destination else []


def list_pull_requests(repo: str, *, branch: str, state: str) -> list[PullRequest]:
    data = _query(repo, "list", ["--head", branch, "--state", state, *_target(repo)])
    if not isinstance(data, list):
        raise ForgeError("Invalid repocli PR list")
    rows = []
    try:
        for row in data:
            key = row["key"]
            if type(key["number"]) is not int or key["number"] <= 0 or row["state"] not in ("open", "closed", "merged"):
                raise ValueError("invalid PR identity or state")
            fields = [row[name] for name in ("title", "sourceBranch", "targetBranch", "url", "headSha")]
            fields.extend((row["sourceRepository"]["path"], key["repository"]["path"]))
            if not all(isinstance(value, str) for value in fields):
                raise ValueError("invalid PR fields")
            rows.append(PullRequest(
                number=key["number"], title=row["title"], state=row["state"],
                source_branch=row["sourceBranch"], target_branch=row["targetBranch"],
                web_url=row["url"], sha=row["headSha"],
                source_repository=row["sourceRepository"]["path"],
                target_repository=key["repository"]["path"],
            ))
    except (KeyError, TypeError, ValueError) as error:
        raise ForgeError("Invalid repocli PR data") from error
    return rows


def pull_request_description(repo: str, number: int, *, target_repository: str | None = None) -> str:
    data = _query(repo, "show", [str(number), *_target(repo, target_repository)])
    if not isinstance(data, dict) or not isinstance(data.get("body"), str):
        raise ForgeError("Invalid repocli PR description")
    return data["body"]

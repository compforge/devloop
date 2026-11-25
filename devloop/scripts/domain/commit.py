"""Commit policy over RepoCLI's prepared content and confirmed result."""
from __future__ import annotations

import subprocess
from dataclasses import dataclass

from repokit import RepoKitError
from repokit.cli import commit_plan_result, create_commit


class CommitError(Exception):
    pass


_SENSITIVE_BASENAMES = {".env", ".DS_Store"}
_SENSITIVE_DIRS = {".idea", ".vscode", "__pycache__", ".devloop"}


def is_sensitive(path: str) -> bool:
    parts = path.split("/")
    return (parts[-1] in _SENSITIVE_BASENAMES or parts[-1].startswith(".env")
            or any(p in _SENSITIVE_DIRS for p in parts))


@dataclass(frozen=True)
class Prepared:
    repo: str
    branch: str
    head: str
    tree: str
    index_fingerprint: str
    mode: str
    files: tuple[str, ...]
    paths: tuple[str, ...]


def _call(repo: str, action: str, arguments: list[str]) -> dict:
    # Import at the CLI boundary: command's repo resolver also imports this policy.
    from repokit.cli import run as run_repocli
    return run_repocli(repo, ("git", "commit", action), arguments, timeout=180)


def prepare(repo: str, branch: str, files: list[str]) -> Prepared:
    mode = "files" if files else "tracked"
    args = ["--mode", mode]
    for path in files:
        args.extend(["--file", path])
    try:
        result = _call(repo, "plan", args)
        if result["outcome"] != "succeeded":
            raise CommitError(f"commit plan failed: {result.get('error', {}).get('message', 'candidate unavailable')}")
        data = commit_plan_result(result, repo, branch, mode)
        sensitive = [c["path"] for c in data["changes"] if c["newMode"] != "000000" and is_sensitive(c["path"])]
        if sensitive:
            raise CommitError(f"candidate contains sensitive paths: {sensitive!r}; index unchanged")
        return Prepared(repo, branch, data["head"], data["tree"], data["indexFingerprint"], mode,
                        tuple(data["paths"]), tuple(c["path"] for c in data["changes"]))
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise CommitError(f"commit plan unavailable; no commit attempted: {error}") from error


def create(prepared: Prepared, message: str, plan: list[str]) -> str:
    if not prepared.paths:
        plan.append("nothing selected — skipped commit")
        return ""
    try:
        data = create_commit(prepared.repo, prepared.branch, head=prepared.head, tree=prepared.tree,
                             index_fingerprint=prepared.index_fingerprint, mode=prepared.mode,
                             files=prepared.files, message=message)
    except RepoKitError as error:
        raise CommitError(error.text()) from error
    plan.append(f"confirmed commit {data['commit']} ({len(prepared.paths)} paths)")
    plan.extend(f"warning: {item['message']}" for item in data["diagnostics"])
    return data["commit"]

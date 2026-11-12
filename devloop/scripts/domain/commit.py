"""Commit policy over RepoCLI's prepared content and confirmed result."""
from __future__ import annotations

import re
import shlex
import subprocess
from dataclasses import dataclass

from repokit.cli import commit_plan_result, commit_result


class CommitError(Exception):
    pass


_SENSITIVE_BASENAMES = {".env", ".DS_Store"}
_SENSITIVE_DIRS = {".idea", ".vscode", "__pycache__", ".devloop"}


def is_sensitive(path: str) -> bool:
    parts = path.split("/")
    return (parts[-1] in _SENSITIVE_BASENAMES or parts[-1].startswith(".env")
            or any(p in _SENSITIVE_DIRS for p in parts))


def oid(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", value) is not None


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

    def identity_args(self) -> list[str]:
        return ["--branch", self.branch, "--head", self.head, "--tree", self.tree]

    def recovery(self) -> str:
        return shlex.join(["repocli", "git", "commit", "check", "--repo", self.repo, *self.identity_args()])


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
        data = result.get("data")
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
    args = ["--mode", prepared.mode, *prepared.identity_args(), "--index-fingerprint", prepared.index_fingerprint,
            "--message", message]
    for path in prepared.files:
        args.extend(["--file", path])
    try:
        result = _call(prepared.repo, "create", args)
        data = result.get("data")
        data = commit_result(result, prepared.repo, prepared.branch, prepared.head, prepared.tree, prepared.index_fingerprint)
        if (result["outcome"] != "succeeded" or data.get("confirmed") is not True
                or not oid(data.get("commit")) or data.get("actualTree") != prepared.tree
                or data.get("parents") != ([] if prepared.head == "unborn" else [prepared.head])):
            raise CommitError(f"commit not confirmed; actual={data.get('commit')} recovery={data.get('recoveryPath')}; "
                              f"inspect with {prepared.recovery()}")
        plan.append(f"confirmed commit {data['commit']} ({len(prepared.paths)} paths)")
        plan.extend(f"warning: {d['message']}" for d in data["diagnostics"])
        if data.get("indexInstalled") is not True:
            raise CommitError(f"commit {data['commit']} confirmed, but index needs recovery at {data.get('recoveryPath')}; "
                              "stop before push; do not repeat commit")
        return data["commit"]
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise CommitError(f"commit result unavailable; inspect with {prepared.recovery()} before retrying: {error}") from error

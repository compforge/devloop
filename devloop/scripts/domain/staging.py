"""Commit selection and validation policy; repocli owns the index transaction."""
from __future__ import annotations

import os
from pathlib import Path

from repocli import git, git_index


class StagingError(Exception):
    pass


_SENSITIVE_BASENAMES = {".env", ".DS_Store"}
_SENSITIVE_DIRS = {".idea", ".vscode", "__pycache__", ".devloop"}


def is_sensitive(path: str) -> bool:
    parts = path.split("/")
    return (parts[-1] in _SENSITIVE_BASENAMES or parts[-1].startswith(".env")
            or any(p in _SENSITIVE_DIRS for p in parts))


def _scope(repo: str, files: list[str]) -> list[str]:
    root = Path(repo).resolve()
    paths = []
    for name in files:
        if not name:
            raise StagingError("--file requires a nonempty literal path")
        # Paths are literal, including whitespace and symlinks. Never resolve the leaf.
        candidate = Path(os.path.abspath(root / name))
        candidate = candidate.parent.resolve() / candidate.name
        try:
            paths.append(candidate.relative_to(root).as_posix())
        except ValueError as exc:
            raise StagingError(f"--file is outside the repository: {name!r}") from exc
    return paths


def _matches(path: str, scope: list[str]) -> bool:
    return any(s == "." or path == s or path.startswith(s + "/") for s in scope)


def stage(repo: str, files: list[str], plan: list[str]) -> git.GitResult:
    scope = _scope(repo, files)
    entries = git_index.status_entries(repo)
    for path in scope:
        known = any(_matches(e.path.rstrip("/"), [path])
                    or (e.original_path is not None and _matches(e.original_path, [path]))
                    for e in entries)
        if not known and not os.path.lexists(Path(repo) / path):
            raise StagingError(f"--file path does not exist or name a tracked deletion: {path!r}")

    to_add = []
    for entry in entries:
        path = entry.path.rstrip("/")  # Git represents an embedded repository with a trailing slash.
        if scope and not _matches(path, scope):
            continue
        if is_sensitive(path):
            plan.append(f"skipped sensitive: {path}")
            continue
        # An index-only deletion/rename is already staged; re-adding a missing path fails.
        if entry.worktree_status != " ":
            to_add.append(path)

    def validate(changes: list[git_index.IndexChange]) -> None:
        outside = [e.path for e in changes if scope and not _matches(e.path, scope)]
        if outside:
            raise StagingError(
                f"index contains paths outside --file scope: {outside!r}; index unchanged. "
                "Include these paths explicitly or handle their staging separately."
            )
        # why: removing tracked sensitive content must remain possible; only changes
        # that leave content at a sensitive path violate the policy.
        sensitive = [e.path for e in changes if e.new_mode != "000000" and is_sensitive(e.path)]
        if sensitive:
            raise StagingError(f"index contains sensitive paths: {sensitive!r}; index unchanged")
        # Deleting a gitlink is safe; only links remaining in the proposed index need registration.
        links = [e.path for e in changes if e.new_mode == "160000"]
        if links:
            registered = set(git_index.registered_submodules(repo))
            unregistered = [p for p in links if p not in registered]
            if unregistered:
                raise StagingError(f"unregistered gitlink: {unregistered!r}; index unchanged")

    # spec: only a validated full index may replace the user's original staging,
    # including partial hunks. Rejecting any candidate never requires reset/rollback.
    result = git.stage(repo, to_add, validate=validate)
    if result.ok:
        shown = ", ".join(to_add[:8]) + (" …" if len(to_add) > 8 else "")
        plan.append(f"staged {len(to_add)} file(s): {shown}" if to_add else "validated existing index")
    return result

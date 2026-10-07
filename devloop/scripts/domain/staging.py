"""Commit selection and validation policy; repocli owns the index transaction."""
from __future__ import annotations

import os
from dataclasses import dataclass
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


def _matches(path: str, scope: list[str] | tuple[str, ...]) -> bool:
    return any(s == "." or path == s or path.startswith(s + "/") for s in scope)


@dataclass(frozen=True)
class Selection:
    """Literal commit paths shared by validation and staging, plus worktree additions."""
    scope: tuple[str, ...]
    paths: tuple[str, ...]
    to_add: tuple[str, ...]


def select(repo: str, files: list[str], plan: list[str] | None = None) -> Selection:
    scope = _scope(repo, files)
    entries = git_index.status_entries(repo)
    for path in scope:
        known = any(_matches(e.path.rstrip("/"), [path])
                    or (e.original_path is not None and _matches(e.original_path, [path]))
                    for e in entries)
        if not known and not os.path.lexists(Path(repo) / path):
            raise StagingError(f"--file path does not exist or name a tracked deletion: {path!r}")

    paths: list[str] = []
    to_add: list[str] = []
    for entry in entries:
        path = entry.path.rstrip("/")
        if entry.original_path and entry.index_status == "R":
            original = entry.original_path
            if not scope or _matches(original, scope):
                paths.append(original)
        if scope and not _matches(path, scope):
            continue
        if is_sensitive(path):
            if entry.index_status == "D":
                paths.append(path)
            elif plan is not None:
                plan.append(f"skipped sensitive: {path}")
            continue
        paths.append(path)
        # Index-only deletions/renames are already staged; do not re-add absent paths.
        if entry.worktree_status != " ":
            to_add.append(path)
    return Selection(tuple(scope), tuple(dict.fromkeys(paths)), tuple(dict.fromkeys(to_add)))


def stage(repo: str, files: list[str], plan: list[str]) -> git.GitResult:
    selection = select(repo, files, plan)
    scope, to_add = selection.scope, selection.to_add

    def validate(index: git_index.IndexView) -> None:
        changes = index.changes
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
        # why: registration must describe the candidate commit, not an unstaged
        # manifest. Changing the manifest can also orphan an unchanged gitlink.
        changed = {e.path for e in changes}
        links = [e.path for e in index.entries if e.mode == "160000"
                 and (e.path in changed or ".gitmodules" in changed)]
        if links:
            registered = set(index.config_values(".gitmodules", r"^submodule\..*\.path$"))
            unregistered = [p for p in links if p not in registered]
            if unregistered:
                raise StagingError(f"unregistered gitlink: {unregistered!r}; index unchanged")

    # spec: only a validated full index may replace the user's original staging,
    # including partial hunks. Rejecting any candidate never requires reset/rollback.
    result = git.stage(repo, list(to_add), validate=validate)
    if result.ok:
        shown = ", ".join(to_add[:8]) + (" …" if len(to_add) > 8 else "")
        plan.append(f"staged {len(to_add)} file(s): {shown}" if to_add else "validated existing index")
    return result

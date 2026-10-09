"""Commit selection and validation policy; repocli owns the index transaction."""
from __future__ import annotations

import hashlib
import os
import stat
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


def stage(repo: str, files: list[str], plan: list[str], *, validated_identity: str = "") -> git.GitResult:
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

        if validated_identity:
            require_validated_candidate(repo, index, validated_identity)

    # spec: only a validated full index may replace the user's original staging,
    # including partial hunks. Rejecting any candidate never requires reset/rollback.
    result = git.stage(repo, list(to_add), validate=validate)
    if result.ok:
        shown = ", ".join(to_add[:8]) + (" …" if len(to_add) > 8 else "")
        plan.append(f"staged {len(to_add)} file(s): {shown}" if to_add else "validated existing index")
    return result


def require_validated_candidate(repo: str, index: git_index.IndexView, identity: str) -> None:
    """Accept only the exact bytes checked in the working tree, without moving user edits.

    This runs inside repocli's index transaction: observe only, never execute project
    commands under Git's writer lock. Filters that transform source bytes are rejected
    conservatively because those committed bytes were not the validation subject.
    """
    from domain.validation import content_identity

    def require_identity() -> None:
        observed = content_identity(repo)
        if not observed.digest or observed.digest != identity:
            raise StagingError("contents changed since validation; rerun checks; index unchanged")

    require_identity()
    root = Path(repo).resolve()
    listed = git.git(repo, "ls-files", "--cached", "--others", "--exclude-standard", "-z", raw=True)
    if not listed.ok:
        raise StagingError("cannot observe validation inputs; index unchanged")
    original = {entry.path: entry for entry in git_index.index_view(repo).entries}
    names = {name for name in listed.out.split("\0") if name
             and (os.path.lexists(root / name) or original.get(name) and original[name].mode == "160000")}
    candidates = {entry.path: entry for entry in index.entries}
    different = names.symmetric_difference(candidates)
    for name in names.intersection(candidates):
        entry, path = candidates[name], root / name
        if entry.stage != 0:
            different.add(name)
            continue
        if entry.mode == "160000":
            # A deinitialized gitlink has no child checkout; its index OID is the input.
            if (path / ".git").exists():
                child = git.git(path, "rev-parse", "HEAD")
                oid = child.out.strip() if child.ok else ""
            else:
                oid = original[name].oid if name in original else ""
            if entry.oid != oid:
                different.add(name)
            continue
        info = path.lstat()
        algorithm = "sha256" if len(entry.oid) == 64 else "sha1"
        if stat.S_ISLNK(info.st_mode):
            data = os.fsencode(os.readlink(path))
            digest = hashlib.new(algorithm, f"blob {len(data)}\0".encode() + data).hexdigest()
            mode = "120000"
        elif stat.S_ISREG(info.st_mode):
            hasher = hashlib.new(algorithm, f"blob {info.st_size}\0".encode())
            with path.open("rb") as source:
                while chunk := source.read(65536):
                    hasher.update(chunk)
            digest = hasher.hexdigest()
            mode = "100755" if info.st_mode & stat.S_IXUSR else "100644"
        else:
            different.add(name)
            continue
        if (entry.oid, entry.mode) != (digest, mode):
            different.add(name)
    require_identity()
    if different:
        raise StagingError(
            f"commit candidate differs from validated working tree: {sorted(different)!r}; "
            "include these paths or validate a clean candidate checkout; index unchanged"
        )

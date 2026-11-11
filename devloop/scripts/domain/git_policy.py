"""Development branch policy over repocli Git observations."""
from __future__ import annotations
import re
from pathlib import Path
from repokit import git as gitcmd
from repokit.git.state import local_default_branch, target_exists
PROTECTED_BRANCH_PATTERNS = tuple(re.compile(p) for p in (r"^main$",r"^master$",r"^release$",r"^release.*",r".*release$"))

def is_protected_branch(branch: str | None) -> bool:
    if not branch:
        return False
    return any(p.match(branch) for p in PROTECTED_BRANCH_PATTERNS)

def local_default_target(repo_dir: str | Path) -> str:
    """Read the default MR target from the *local* origin/HEAD cache — the offline FALLBACK.

    Pure-local, zero network, safe on hot paths. NOT the authority: `git fetch` never refreshes
    `refs/remotes/origin/HEAD`, so this can lag. The authority is the forge value cached in
    `RepoMeta.default_branch` (resolved on a TTL boundary) — callers prefer that and only fall
    here when it's empty / unavailable. No "release" bias: when origin/HEAD is absent, fall back
    to whichever of main/master exists, else main.
    """
    branch = local_default_branch(repo_dir)
    if branch is not None:
        return branch
    for b in ("main", "master"):
        if target_exists(repo_dir, b):
            return b
    return "main"

def ensure_gitignore_excluded(repo_dir: str | Path, pattern: str = "/.devloop/") -> None:
    """Best-effort local exclusion; patterns and failure acceptance belong to devloop."""
    try:
        gitcmd.add_exclude(repo_dir, pattern)
    except OSError:
        pass  # Local bookkeeping should not block the development workflow.

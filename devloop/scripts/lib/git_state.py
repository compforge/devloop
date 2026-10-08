"""Development branch policy over repocli Git observations."""
from __future__ import annotations
import re
from pathlib import Path
from repocli import git as gitcmd
from repocli.git_state import (
    get_current_branch as get_current_branch,
    get_ahead_behind as get_ahead_behind,
    get_workspace_status as get_workspace_status,
    target_exists as target_exists,
    local_default_branch,
    refresh_remote_head as refresh_remote_head,
    set_local_default_head as set_local_default_head,
    checkout_info as checkout_info,
    get_head_sha as get_head_sha,
    rev_parse as rev_parse,
    is_ancestor as is_ancestor,
    get_upstream_ahead_behind as get_upstream_ahead_behind,
    ls_remote_tips as ls_remote_tips,
    list_checkouts as list_checkouts,
    main_repo_root as main_repo_root,
    list_local_branches as list_local_branches,
    fetch as fetch,
    git_path as git_path,
    rebase_in_progress as rebase_in_progress,
)
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

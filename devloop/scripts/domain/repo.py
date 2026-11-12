"""Repo domain boundary: identity, resolution, and commit/review path selection.

The aggregate-workspace loop's single biggest observed tax is that the shell's cwd
snaps back to the workspace root between Bash calls, so every script invocation had
to be hand-prefixed with `cd <repo> && ...` — and a missed prefix died with
"not a git repo". This module gives scripts a cwd-independent answer, resolved from
the state bus instead of the shell:

  1. explicit query — a path, or a subproject name fuzzy-matched against the
     registered workspaces' structured state (`context.json` subprojects);
  2. cwd's enclosing git repo (the classic case, unchanged);
  3. THIS session's bound repo in the cwd workspace (`.devloop/active/<sid>.json`,
     one file per session, stamped by the activity writers: CwdChanged / PostToolUse
     hooks and the smart scripts themselves; scripts self-identify via
     the runtime identity (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`).
     Concurrent sessions on different repos can't poison
     each other's fallback; a session with no binding of its own must say --repo —
     other sessions' bindings are only ever surfaced as a hint in that error.

Fuzzy scoring is shared with the managed-worktree resolver, so a name means the
same thing everywhere.
"""
from __future__ import annotations
from repokit.git import committed_paths as toolkit_committed_paths

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from domain import repo_layout

from . import repo_layout, workspace
from .context import RepoContext, WorkspaceContext
from .context.session import active_repo_candidates, load_active_repo
from .context.workspace import workspace_for_repo


@dataclass(frozen=True)
class Repo:
    """A repo's stable identities, computed once at the resolution boundary so
    consumers stop re-deriving them ad hoc（symlink/canonical/component 语义散落在各消费方
    时，路径不一致问题会反复出现）:

    - `git_root`: 解析入口路径（可能经 symlink，保留调用方视角）
    - `real_git_root`: realpath 后的 canonical 路径（比较 / rebase 用这个）
    - `target_path`: 解析入口的操作目标路径——显式路径 / cwd 落在仓内时有值，按名字 / last-active
      兜底时为 None。它记录解析来源；验证范围由 RepoKit 规划。
    - `workspace_root`: 所属聚合工作区根（单仓库模式为 None）
    - `source`: 解析来源自述（"cwd" / "subproject 'x'" / …），进 PLAN banner
    """
    git_root: str
    real_git_root: str
    target_path: str | None
    workspace_root: str | None
    source: str


@dataclass(frozen=True)
class RepoResolution:
    """Interactive repo resolution without coupling the resolver to CLI output."""

    path: str | None = None
    candidates: tuple[tuple[str, str], ...] = ()
    reason: str = ""


def committed_paths(git_root: str | Path, rev: str = "HEAD") -> list[str] | None:
    """One commit's paths for workflow hooks; failed observation stays unknown."""
    try:
        return toolkit_committed_paths(git_root, rev)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def _resolved(git_root: str, source: str, target_path: str | Path | None = None) -> tuple[Repo, str]:
    """Retain repository identity and the explicit/cwd target used for resolution."""
    # workspace_for_repo, NOT plain containment: workspaces are symlink farms, so the
    # canonical git_root usually lives outside the workspace tree — containment-only
    # would report workspace_root=None for every symlinked subproject (Mode B 误判)
    ws = workspace_for_repo(git_root)
    r = Repo(
        git_root=str(git_root),
        real_git_root=str(Path(git_root).resolve()),
        target_path=str(target_path) if target_path is not None else None,
        workspace_root=str(ws) if ws else None,
        source=source,
    )
    return r, source


def looks_like_path(s: str) -> bool:
    return "/" in s or s.startswith(".") or s.startswith("~")


def score(query: str, name: str) -> int | None:
    """Lower is better. None = no match."""
    q, n = query.lower(), name.lower()
    if n == q:
        return 0
    if n.startswith(q):
        return 10 + (len(n) - len(q))
    idx = n.find(q)
    if idx >= 0:
        return 100 + idx + (len(n) - len(q))
    i = 0
    for ch in n:
        if i < len(q) and ch == q[i]:
            i += 1
    if i == len(q):
        return 1000 + (len(n) - len(q))
    return None


def best_score(query: str, names: list[str]) -> int | None:
    scores = [sc for name in names if name and (sc := score(query, name)) is not None]
    return min(scores) if scores else None


def match_subprojects(query: str, ws_root: str | Path) -> list[tuple[int, str, str]]:
    """Scored subproject matches in one workspace: (score, name, resolved_abs_path)."""
    ctx = WorkspaceContext.load(ws_root)
    if ctx is None or not ctx.subprojects:
        ctx = WorkspaceContext.refresh(ws_root)
    scored: list[tuple[int, str, str]] = []
    for s in ctx.subprojects:
        if not s.name:
            continue
        sc = best_score(query, [s.name, *s.aliases])
        if sc is None:
            continue
        abs_path = (Path(ws_root) / (s.path or s.name)).resolve()
        if abs_path.is_dir():
            scored.append((sc, s.name, str(abs_path)))
    scored.sort(key=lambda t: (t[0], t[1]))
    return scored


def resolve_repo_target(query: str, cwd: str | Path = ".", *, limit: int = 4) -> RepoResolution:
    """Resolve an explicit repo target by path or fuzzy name.

    Unlike ``resolve_repo_dir``, this entry-point preserves ambiguous candidates so the
    interactive command can ask the user which subproject they meant. Worktree lifecycle
    is deliberately outside this module; resolution only returns paths and reasons.
    """
    cwd = Path(cwd).resolve()
    if looks_like_path(query):
        path = Path(os.path.expanduser(os.path.expandvars(query)))
        if not path.is_absolute():
            path = cwd / path
        path = path.resolve()
        if not path.is_dir():
            return RepoResolution(reason=f"path does not exist: {path}")
        return RepoResolution(path=str(path))

    ws_root = workspace.find_containing_workspace(cwd) or workspace.maybe_register_workspace(cwd)
    if not ws_root:
        return RepoResolution(
            reason=(f"cwd not under any registered workspace; pass a path or run "
                    f"init_workspace first (query={query!r})")
        )
    scored = match_subprojects(query, ws_root)
    if not scored:
        ctx = WorkspaceContext.load(ws_root)
        names = ", ".join(s.name for s in (ctx.subprojects if ctx else []) if s.name)
        if names:
            return RepoResolution(reason=f"no subproject matches {query!r}; known: {names}")
        return RepoResolution(
            reason=(f"workspace {ws_root} has no subprojects "
                    f"(no git-repo subdir/symlink found, and none in AGENTS.md)")
        )
    exact = [item for item in scored if item[0] == 0]
    if len(exact) == 1 or len(scored) == 1:
        return RepoResolution(path=(exact or scored)[0][2])
    candidates = tuple((name, path) for _, name, path in scored[:limit])
    return RepoResolution(candidates=candidates)


def resolve_repo_dir(query: str | None, cwd: str | Path = ".") -> tuple[Repo | None, str]:
    """Resolve (Repo, how). On failure: (None, reason-for-the-caller-to-print).

    `how`（== `Repo.source`）is a short self-narration ("cwd" / "subproject 'x'" /
    "last-active repo") so scripts can put the resolution in their PLAN banner — a wrong
    guess must be visible. Path identities (real/code_dir/workspace) are computed here
    once; consumers must NOT re-derive them from the raw string.
    """
    cwd = Path(cwd).resolve()

    if query:
        if looks_like_path(query):
            p = Path(os.path.expanduser(os.path.expandvars(query)))
            if not p.is_absolute():
                p = cwd / p
            root = repo_layout.find_git_root(p) if p.is_dir() else None
            if root:
                return _resolved(root, f"path '{query}'", target_path=p)
            return None, f"--repo path is not (in) a git repo: {p}"
        # subproject name: containing workspace first (ordering only breaks ties),
        # then every registered workspace — cwd may be anywhere.
        seen: set[str] = set()
        scored: list[tuple[int, str, str]] = []
        containing = workspace.find_containing_workspace(cwd)
        for w in ([containing] if containing else []) + workspace.load_workspaces():
            wr = str(Path(w).resolve())
            if wr in seen:
                continue
            seen.add(wr)
            scored += match_subprojects(query, wr)
        # 同一 repo 可被多个已注册 workspace/symlink 命中；歧义应按 canonical
        # repo 判，不能把同一路径的重复条目当成多个候选。
        by_path: dict[str, tuple[int, str, str]] = {}
        for candidate in scored:
            previous = by_path.get(candidate[2])
            if previous is None or candidate[:2] < previous[:2]:
                by_path[candidate[2]] = candidate
        scored = list(by_path.values())
        if not scored:
            # Not a known subproject — maybe a bare relative dirname (`review.py run --repo devloop`).
            p = cwd / query
            root = repo_layout.find_git_root(p) if p.is_dir() else None
            if root:
                return _resolved(root, f"path '{query}'", target_path=p)
            return None, f"no subproject matches '{query}' in any registered workspace"
        scored.sort(key=lambda t: (t[0], t[1]))
        exact = [x for x in scored if x[0] == 0]
        if len(exact) == 1 or len(scored) == 1:
            path = (exact or scored)[0][2]
            root = repo_layout.find_git_root(path)
            if root:
                return _resolved(root, f"subproject '{(exact or scored)[0][1]}'")
            return None, f"subproject '{query}' resolved to {path}, which is not a git repo"
        cands = ", ".join(f"{n} ({p})" for _, n, p in scored[:4])
        return None, f"'{query}' is ambiguous: {cands} — pass a more specific name or a path"

    root = repo_layout.find_git_root(cwd)
    if root:
        # cwd is the operation target: being in server/ vs cli/ picks that component.
        return _resolved(root, "cwd", target_path=cwd)

    ws_root = workspace.find_containing_workspace(cwd)
    if ws_root:
        active = load_active_repo(ws_root)
        if active:
            return _resolved(active, f"session last-active repo '{Path(active).name}'")
        cands = active_repo_candidates(ws_root)
        if cands:
            names = ", ".join(Path(c).name for c in cands)
            return None, (
                "this session has no repo activity yet "
                f"(other sessions are on: {names}) — pass --repo <name|path>"
            )
        ctx = WorkspaceContext.load(ws_root)
        names = ", ".join(s.name for s in (ctx.subprojects if ctx else []) if s.name)
        known = f"; known subprojects: {names}" if names else ""
        return None, f"cwd is the workspace root and no recent activity recorded — pass --repo <name|path>{known}"

    return None, "not in a git repo — cd into one or pass --repo <name|path>"

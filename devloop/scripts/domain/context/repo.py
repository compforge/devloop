"""Query-time repository view over workflow-owned segments and repocli observations.

meta, branch provenance, remote trunk tips and validation/review evidence belong to devloop.
PR lifecycle state and generic associations belong to repocli; they are never copied into
.devloop. The selected pull_request exists only in this transient view.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

import logging

from lib import git_state, parsers, repokit
from repokit.repository import default_branch as repository_default_branch
from lib.config import forge_client

from .. import repo_layout
from . import base, store
from .base import (
    REPO_STALE_SEC,
    AgentsMd,
    PullRequest,
    Reference,
)


# ── segment dataclasses ──────────────────────────────────────────────────────
@dataclass
class RepoMeta:
    repo_dir: str = ""        # git root as the caller referenced it (symlink preserved)
    real_repo_dir: str = ""   # Path(repo_dir).resolve() — for git IO
    code_dir: str = ""        # where make/uv run (repo root or server/ backend/)
    language: str | None = None
    default_branch: str = ""        # repo characteristic: the forge's default branch (canonical trunk).

    @classmethod
    def from_dict(cls, d: dict | None) -> "RepoMeta":
        d = d or {}
        return cls(
            repo_dir=d.get("repo_dir", ""),
            real_repo_dir=d.get("real_repo_dir", ""),
            code_dir=d.get("code_dir", ""),
            language=d.get("language"),
            default_branch=d.get("default_branch", ""),
        )


@dataclass
class Branch:
    """One branch's facts — its name, its tip commit, where it forked from, and (for a
    worktree entry) its path. A pure value object: "how fresh is this view" is a property of
    whoever holds it (the segment's `fetched_at`), not of the branch itself."""
    name: str | None = None
    commit: str = ""               # tip sha
    fork_from: str | None = None   # branch it forked from; recorded by gcampr at cut, else inferred/None
    path: str | None = ""          # None means a registered checkout with unknown location.

    @classmethod
    def from_dict(cls, d: dict | None) -> "Branch":
        d = d or {}
        return cls(
            name=d.get("name"),
            commit=d.get("commit", ""),
            fork_from=d.get("fork_from"),
            path=d.get("path", ""),
        )

    def is_protected(self) -> bool:
        return git_state.is_protected_branch(self.name)


@dataclass
class BranchTopology:
    """The repo's branch topology across vantages — assembled by `RepoContext.load()` from
    owner-disjoint segments (see module docstring). `local` is the working checkout
    (refresh-owned, the DISPLAY copy); `remotes` are the server trunk tips (monitor-owned);
    `worktrees` are the local linked worktrees (refresh-owned). `remotes_fetched_at`
    carry from their owning segments at load time."""
    local: Branch = field(default_factory=Branch)
    remotes: list[Branch] = field(default_factory=list)        # monitor-owned (remote_branches.json)
    worktrees: list[Branch] = field(default_factory=list)
    target: str = ""                                           # this checkout's trunk; derived from RepoMeta.default_branch at refresh
    remotes_fetched_at: float | None = None                    # provenance of `remotes`

    @classmethod
    def from_local_dict(cls, d: dict | None) -> "BranchTopology":
        """Build the refresh-owned half (local + worktrees) from branch.json. `target` is derived
        from RepoMeta.default_branch by `load` (single source — not stored here); remotes /
        remotes_fetched_at are merged in from their own segments."""
        d = d or {}
        return cls(
            local=Branch.from_dict(d.get("local")),
            worktrees=[Branch.from_dict(w) for w in (d.get("worktrees") or [])],
        )

    def base_branch(self) -> str:
        """The trunk this branch is measured against — its recorded fork point, else the
        repo's canonical target."""
        return self.local.fork_from or self.target

    def remote_tip(self, name: str | None) -> Branch | None:
        return next((r for r in self.remotes if r.name == name), None)


@dataclass
class ComponentValidation:
    """One Component's historical full-check projection, resolved from execution evidence.

    Guards read current evidence and inputs directly; this display view grants no permission.
    """
    last_lint_at: float | None = None
    lint_fingerprint: str = ""
    last_test_at: float | None = None

    @classmethod
    def from_dict(cls, d: dict | None) -> "ComponentValidation":
        d = d or {}
        return cls(
            last_lint_at=d.get("last_lint_at"),
            lint_fingerprint=d.get("lint_fingerprint", "") or "",
            last_test_at=d.get("last_test_at"),
        )


@dataclass
class Validation:
    """Full-check projections keyed by Component, assembled from branch references.

    Check coordinators own separate branch reference segments; Component workers own
    separate execution records. This view neither writes evidence nor issues pass stamps.
    """
    components: dict[str, ComponentValidation] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, lint: dict | None, test: dict | None) -> "Validation":
        """两个 check 段 → 一个视图。段形状 `{unit_id: {...}}`（component 是 key，不是目录）。"""
        out = cls()
        for cid, v in (lint or {}).items():
            if isinstance(v, dict):
                u = out.of(cid)
                u.last_lint_at = v.get("passed_at")
                u.lint_fingerprint = v.get("fingerprint", "") or ""
        for cid, v in (test or {}).items():
            if isinstance(v, dict):
                out.of(cid).last_test_at = v.get("passed_at")
        return out

    def component(self, cid: str) -> ComponentValidation:
        """`cid` 的戳，只读；从未验过 → 全空默认值（无戳即未验，fail-closed）。"""
        return self.components.get(cid) or ComponentValidation()

    def of(self, cid: str) -> ComponentValidation:
        """`cid` 的戳，可写（缺则建）——mutator 专用。"""
        return self.components.setdefault(cid, ComponentValidation())


@dataclass
class RepoContext:
    repo: RepoMeta = field(default_factory=RepoMeta)
    agents_md: AgentsMd = field(default_factory=AgentsMd)
    branch: BranchTopology = field(default_factory=BranchTopology)
    validation: Validation = field(default_factory=Validation)
    pull_request: PullRequest | None = None
    provider: str = ""
    updated_at: float = 0.0

    # ── load (merge segments) ──────────────────────────────────────────────────
    @classmethod
    def load(cls, repo_dir: str | Path) -> "RepoContext | None":
        """Assemble the in-memory view by merging the per-owner segment files.

        `meta` is the existence marker: absent → not initialized → None (caller
        refresh_all's). Every other segment defaults independently, so one missing /
        corrupt file degrades to its default without losing the rest (fail-open)."""
        meta = store.load_segment(repo_dir, "meta")
        if meta is None:
            return None
        # Branch-domain segments live under branches/<branch>/ — keyed by the LIVE branch (one
        # rev-parse), not by whatever some cached file last observed. This kills the whole
        # "stale branch.json after an unobserved checkout fools the display" class structurally:
        # switching branches switches which segment directory is read.
        from domain.validation_evidence import full_projection

        live = git_state.get_current_branch(repo_dir)
        branch = BranchTopology.from_local_dict(
            store.load_segment(repo_dir, store.branch_segment(live, "branch")) or {})
        if not branch.local.name:
            branch.local.name = live or ""   # fresh/missing segment: identity is still the live read
        branch.target = (meta.get("repo") or {}).get("default_branch", "")   # single source: RepoMeta.default_branch
        # monitor-owned remote trunk tips (remote_branches.json) + their provenance stamp.
        rb = store.load_segment(repo_dir, "remote_branches") or {}
        branch.remotes = [Branch.from_dict(r) for r in (rb.get("remotes") or [])]
        branch.remotes_fetched_at = rb.get("fetched_at")
        # Query the library for the live checkout; display availability is independent of gates.
        from .prstate import checkout_pr
        provider, association = checkout_pr(str(repo_dir))
        selected = association.selected if association and association.branch == live else None
        ctx = cls(
            repo=RepoMeta.from_dict(meta.get("repo")),
            agents_md=AgentsMd.from_dict(meta.get("agents_md") or {}),
            branch=branch,
            validation=Validation.from_dict(
                full_projection(str(repo_dir), live, "lint"),
                full_projection(str(repo_dir), live, "test")),
            pull_request=selected,
            provider=provider,
            updated_at=float(meta.get("updated_at", 0) or 0),
        )
        if not ctx.repo.repo_dir:
            ctx.repo.repo_dir = str(Path(repo_dir))
        return ctx

    # ── per-owner segment writers ──────────────────────────────────────────────
    # Each writes exactly one file. A writer-role only ever calls its own saver, so
    # two concurrent writers (e.g. the monitor and a refresh) touch disjoint files —
    # the lost-update class is structurally impossible, no lock needed.
    def _root(self) -> str:
        return self.repo.repo_dir or self.repo.real_repo_dir

    def _save_meta(self) -> None:
        root = self._root()
        if not root:
            return
        self.updated_at = base.now()
        store.save_segment(root, "meta", {
            "repo": asdict(self.repo),
            "agents_md": asdict(self.agents_md),
            "updated_at": self.updated_at,
        })
        git_state.ensure_gitignore_excluded(root)   # keep /.devloop/ out of git

    def _branch_seg(self, name: str) -> str:
        """Branch-domain segment name for THIS context's branch (branches/<b>/<name>)."""
        return store.branch_segment(self.branch.local.name or None, name)

    def _save_branch(self) -> None:
        """Refresh-owned: the LOCAL half only (local + worktrees + target). `remotes` is the
        monitor's (remote_branches.json); PR association is queried, never written here."""
        if not self._root():
            return
        store.save_segment(self._root(), self._branch_seg("branch"), {
            "local": asdict(self.branch.local),
            "worktrees": [asdict(w) for w in self.branch.worktrees],
        })   # target not persisted here — derived from meta.default_branch (single source)


    # ── refresh (re-derive from authoritative sources) ─────────────────────────
    @classmethod
    def refresh_all(cls, repo_dir: str | Path) -> "RepoContext":
        """Full rebuild (normal-impl boundary: SessionStart / enter / TTL).

        Writes only the refresher-owned segments (meta + branch). validation /
        review / remote_branches live in their own files and are left untouched — their values
        are merged in (via prev) only to keep the *returned* object complete."""
        repo_dir_in = str(Path(repo_dir))
        repo_dir_abs = str(Path(repo_dir).resolve())
        code_dir, language = "", None
        try:
            catalog = repo_layout.inspect_catalog(repo_dir_abs)
            if catalog.components:
                component = catalog.default()
                code_dir, language = component.path, component.language
        except repokit.InspectionError as exc:
            # Optional context metadata must not turn a completed Git action into failure.
            logging.getLogger(__name__).warning("Component context unavailable for %s: %s", repo_dir_abs, exc)
        agents_md_path = repo_layout.find_agents_md(repo_dir_abs, code_dir)

        prev = cls.load(repo_dir_abs) or cls()
        # RepoKit owns observation freshness; this is only the development target projection.
        observed = repository_default_branch(repo_dir_abs, forge=forge_client(repo_dir_abs))
        default_branch = observed.branch or git_state.local_default_target(repo_dir_abs)
        target = default_branch
        items = parsers.parse_references_section(agents_md_path) if agents_md_path else []
        from domain.validation_evidence import full_projection

        branch = _build_topology(repo_dir_abs, target, prev.branch)
        # A check can produce evidence before repo metadata has ever been refreshed.
        # Resolve that evidence directly rather than inheriting an empty previous view.
        validation = Validation.from_dict(
            full_projection(repo_dir_abs, branch.local.name, "lint"),
            full_projection(repo_dir_abs, branch.local.name, "test"))
        ctx = cls(
            repo=RepoMeta(repo_dir=repo_dir_in, real_repo_dir=repo_dir_abs,
                          code_dir=code_dir, language=language,
                          default_branch=default_branch),
            agents_md=AgentsMd(
                path=agents_md_path,
                references=[Reference(title=r.get("title", ""), path=r.get("path", ""),
                                      hook=r.get("description")) for r in items],
            ),
            branch=branch,
            validation=validation,
            pull_request=prev.current_pr(),
            provider=prev.provider,
        )
        ctx._save_meta()
        ctx._save_branch()
        return ctx

    @classmethod
    def refresh_branch(cls, repo_dir: str | Path) -> "RepoContext":
        """Incremental branch refresh (fast; after a local git state change). No AGENTS.md
        re-parse. Writes only branch.json. Not-yet-initialized → fall back to a full build."""
        ctx = cls.load(repo_dir)
        if ctx is None:
            return cls.refresh_all(repo_dir)
        # cached repo fact (zero network); local origin/HEAD only if cache empty
        target = ctx.repo.default_branch or git_state.local_default_target(ctx.repo.real_repo_dir)
        ctx.branch = _build_topology(ctx.repo.real_repo_dir, target, ctx.branch)
        ctx._save_branch()
        return ctx

    @classmethod
    def is_stale_at(cls, repo_dir: str | Path, ttl: float = REPO_STALE_SEC) -> bool:
        meta = store.load_segment(repo_dir, "meta")
        if meta is None:
            return True
        return base.is_stale(meta.get("updated_at"), ttl)

    # ── mutators (each touches exactly one segment) ─────────────────────────────


    def set_fork_from(self, fork_from: str | None) -> None:
        """gcampr's surface: record where the (just-cut) current branch forked from — the one
        branch fact git doesn't durably keep. Sticky: `_build_topology` preserves it across
        refreshes, so a later rebuild-from-git won't clobber it."""
        self.branch.local.fork_from = fork_from
        self._save_branch()

    # ── PR derivation (DISPLAY-grade; write-gates use domain.context.gate) ─────────
    def current_pr(self) -> PullRequest | None:
        pr = self.pull_request
        return pr if pr and pr.source_branch == self.branch.local.name else None

    def branch_pr_inactive(self) -> bool:
        """True if the current branch's PR/MR is merged/closed (derived, not stored).

        DISPLAY-grade — keyed off the *cached* branch name. The hard gates do NOT read this;
        they re-derive against the LIVE branch + HEAD via `domain.context.gate` (a cached branch
        name could be stale after an unobserved checkout). See docs/branch-state.md."""
        p = self.current_pr()
        return bool(p and p.inactive)

    def branch_pr_in_flight(self) -> bool:
        """True if the current branch's PR/MR is still open / awaiting human merge (derived).
        DISPLAY-grade (see `branch_pr_inactive`). Surfaced so the orchestrator notes that
        committing here continues an in-flight PR, and new work re-bases off origin/<target>."""
        p = self.current_pr()
        return bool(p and p.is_open)

    # Compatibility previews for callers that need text without mutating Board receipts.
    def turn_text(self) -> str:
        from domain.board import (
            DeliveryChannel,
            DeliveryPolicy,
            PromptScope,
            project_view,
            render_prompt,
        )

        _, view = project_view(self.repo.repo_dir, repo=self)
        items = DeliveryPolicy.items_for(
            view,
            DeliveryChannel.PROMPT,
            frozenset({PromptScope.TURN}),
        )
        return render_prompt(items)

    def session_text(self) -> str:
        from domain.board import (
            DeliveryChannel,
            DeliveryPolicy,
            PromptScope,
            project_view,
            render_prompt,
        )

        _, view = project_view(self.repo.repo_dir, repo=self)
        items = DeliveryPolicy.items_for(
            view,
            DeliveryChannel.PROMPT,
            frozenset({PromptScope.SESSION}),
        )
        return render_prompt(items)

# ── private builders / renderers ──────────────────────────────────────────────
def _build_topology(repo_dir: str, target: str, prev: BranchTopology | None) -> BranchTopology:
    """Rebuild the LOCAL half (identity + worktrees) from live git, preserving the
    monitor-owned and git-unrecorded facts from `prev` so the returned object stays whole.

    `fork_from` is git-unrecorded → carried from `prev` ONLY when the branch name is unchanged
    (a switch drops the old branch's fork point; gcampr re-records on the next cut). remotes /
    remotes_fetched_at are merged from prev (load re-reads them from disk anyway)."""
    name = git_state.get_current_branch(repo_dir)
    commit = git_state.get_head_sha(repo_dir)
    fork_from = prev.local.fork_from if (prev is not None and prev.local.name == name) else None
    worktrees = [Branch(name=e.branch, commit=e.head, path=e.path) for e in git_state.list_checkouts(repo_dir)]
    topo = BranchTopology(
        local=Branch(name=name, commit=commit, fork_from=fork_from),
        worktrees=worktrees,
        target=target,
    )
    if prev is not None:
        topo.remotes = prev.remotes
        topo.remotes_fetched_at = prev.remotes_fetched_at
    return topo

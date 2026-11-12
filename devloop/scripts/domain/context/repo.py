"""Transient repository view; RepoKit owns repository facts and creation provenance.

Only parsed AGENTS knowledge is cached in devloop. Session/task policy and review
remain devloop-owned; repository observations are queried through the public SDK.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path

from repokit.state import checkout_view, remote_branches

from domain import git_policy
from domain.context import agents as parsers

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



@dataclass
class Branch:
    """Current branch identity and optional historical RepoKit creation provenance."""
    name: str | None = None
    commit: str = ""               # tip sha
    creation_base: str | None = None   # RepoKit-confirmed creation base; never a task baseline
    path: str | None = ""          # None means a registered checkout with unknown location.

    def is_protected(self) -> bool:
        return git_policy.is_protected_branch(self.name)


@dataclass
class BranchTopology:
    """Transient display projection of RepoKit facts plus the selected task target."""
    local: Branch = field(default_factory=Branch)
    remotes: list[Branch] = field(default_factory=list)        # RepoKit remote observation
    worktrees: list[Branch] = field(default_factory=list)
    target: str = ""                                           # selected PR target or workflow default
    remotes_fetched_at: float | None = None                    # provenance of `remotes`

    def base_branch(self) -> str:
        """Selected PR target or workflow default; creation provenance is historical."""
        return self.target

    def remote_tip(self, name: str | None) -> Branch | None:
        return next((r for r in self.remotes if r.name == name), None)


@dataclass
class RepoContext:
    repo: RepoMeta = field(default_factory=RepoMeta)
    agents_md: AgentsMd = field(default_factory=AgentsMd)
    branch: BranchTopology = field(default_factory=BranchTopology)
    pull_request: PullRequest | None = None
    provider: str = ""
    updated_at: float = 0.0

    @classmethod
    def load(cls, repo_dir: str | Path) -> "RepoContext | None":
        knowledge = store.load_segment(repo_dir, "agents")
        if knowledge is None:
            return None
        return cls._observe(repo_dir, knowledge)

    @classmethod
    def _observe(cls, repo_dir: str | Path, knowledge: dict) -> "RepoContext":
        facts = checkout_view(repo_dir)
        code_dir, language = "", None
        try:
            catalog = repo_layout.inspect_catalog(facts.root)
            if catalog.components:
                component = catalog.default()
                code_dir, language = component.path, component.language
        except repo_layout.InspectionError as exc:
            logging.getLogger(__name__).warning("Component context unavailable repo=%s error=%s", facts.root, exc)
        from .prstate import checkout_pr
        provider, association = checkout_pr(facts.root)
        selected = association.selected if association and association.branch == facts.branch else None
        # A task's comparison base follows its selected PR/default target. Creation
        # provenance is exposed separately and never silently changes that selection.
        target = selected.target_branch if selected else facts.default_branch or git_policy.local_default_target(facts.root)
        remotes, observed_at = [], None
        try:
            remote = remote_branches(facts.root, (target,))
            remotes = [Branch(name=name, commit=sha) for name, sha in remote.tips]
            observed_at = remote.observed_at
        except OSError as exc:
            logging.getLogger(__name__).warning("Remote context unavailable repo=%s error=%s", facts.root, exc)
        return cls(
            repo=RepoMeta(repo_dir=str(repo_dir), real_repo_dir=facts.root, code_dir=code_dir,
                          language=language, default_branch=facts.default_branch or ""),
            agents_md=AgentsMd.from_dict(knowledge.get("agents_md") or {}),
            branch=BranchTopology(
                local=Branch(name=facts.branch, commit=facts.head,
                             creation_base=facts.creation.base_ref if facts.creation else None, path=facts.root),
                worktrees=[Branch(name=e.branch, commit=e.head, path=e.path) for e in facts.checkouts],
                target=target, remotes=remotes, remotes_fetched_at=observed_at),
            pull_request=selected, provider=provider, updated_at=float(knowledge.get("updated_at", 0)),
        )

    @classmethod
    def refresh_all(cls, repo_dir: str | Path) -> "RepoContext":
        root = str(Path(repo_dir).resolve())
        context = cls._observe(repo_dir, {})
        agents_path = repo_layout.find_agents_md(root, context.repo.code_dir)
        items = parsers.parse_references_section(agents_path) if agents_path else []
        agents = AgentsMd(path=agents_path, references=[Reference(title=r.get("title", ""),
            path=r.get("path", ""), hook=r.get("description")) for r in items])
        knowledge = {"agents_md": asdict(agents), "updated_at": base.now()}
        store.save_segment(root, "agents", knowledge)
        git_policy.ensure_gitignore_excluded(root)
        context.agents_md = agents
        context.updated_at = knowledge["updated_at"]
        return context

    @classmethod
    def refresh_branch(cls, repo_dir: str | Path) -> "RepoContext":
        return cls.load(repo_dir) or cls.refresh_all(repo_dir)

    @classmethod
    def is_stale_at(cls, repo_dir: str | Path, ttl: float = REPO_STALE_SEC) -> bool:
        knowledge = store.load_segment(repo_dir, "agents")
        return knowledge is None or base.is_stale(knowledge.get("updated_at"), ttl)

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

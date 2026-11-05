"""repo_dir / repo_code_dir / language / AGENTS.md location helpers.

Repository discovery and organization come from repokit.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from repokit import Layout, Tool, Depot

from lib import repokit
from repokit.git.state import find_checkout


@dataclass(frozen=True)
class Component:
    """Repocli Component metadata used by the development workflow.

    id is the checkout-relative root used by validation stamps; name is the
    repository identity supplied by repokit. Neither discovery nor language
    inference belongs to this wrapper. at() constructs an explicit test/task
    target; inspect_catalog() constructs discovered components.
    """
    path: str
    id: str
    language: str | None = None
    name: str = ""
    tools: tuple[Tool, ...] = ()
    depot: Depot | None = None
    tool_evidence: dict[str, tuple[str, ...]] = field(default_factory=dict, compare=False)

    @classmethod
    def at(cls, path: str | Path, git_root: str | Path) -> "Component":
        """Construct an explicit execution target without claiming discovered metadata."""
        p = Path(path).resolve()
        root = Path(git_root).resolve()
        try:
            cid = p.relative_to(root).as_posix()
        except ValueError:
            # component 落在仓外（不该发生）：退回绝对路径而不是抛——身份算不准最多让戳对不上
            # （fail-closed，多跑一次 lint），把关路径上崩掉才是真事故。
            cid = p.as_posix()
        return cls(str(path), cid)


def find_git_root(cwd: str | Path) -> str | None:
    """No checkout is None; failed discovery remains an error for caller policy."""
    return find_checkout(cwd)


def is_git_repo(path: str | Path) -> bool:
    return find_git_root(path) is not None


@dataclass(frozen=True)
class Catalog:
    """One observed layout, reused for every ownership query in a selection."""
    root: Path
    components: tuple[Component, ...]
    report: Layout

    @classmethod
    def from_layout(cls, root: str | Path, report: Layout) -> "Catalog":
        root = Path(root).resolve()
        components = tuple(Component(str(root / item.root), item.root, item.language, item.name, item.tools or (), item.depot, item.tool_evidence)
                           for item in report.components)
        return cls(root, components, report)

    def owner(self, target: str | Path) -> Component | None:
        path = Path(os.path.abspath(target))
        if not path.is_relative_to(self.root):
            return None
        binding = repokit.owner(self.report, path.relative_to(self.root).as_posix())
        return next((c for c in self.components if binding and c.id == binding.root), None)

    def default(self) -> Component:
        # This is execution selection, not discovery or a claim of file ownership.
        for preferred in ("server", "backend", "."):
            if component := next((c for c in self.components if c.id == preferred), None):
                return component
        if len(self.components) == 1:
            return self.components[0]
        raise repokit.InspectionError("no default Component; select a discovered component explicitly")


def inspect_catalog(git_root: str | Path) -> Catalog:
    root = Path(git_root).resolve()
    report = repokit.inspect(str(root))
    return Catalog.from_layout(root, report)


def find_repo_code_dir(repo_dir: str | Path) -> str:
    return default_component(repo_dir).path


def default_component(git_root: str | Path) -> Component:
    return inspect_catalog(git_root).default()


def owning_component(target: str | Path, git_root: str | Path, *, catalog: Catalog | None = None) -> Component | None:
    return (catalog or inspect_catalog(git_root)).owner(target)


def enclosing_component(target: str | Path, git_root: str | Path, *, catalog: Catalog | None = None) -> Component:
    catalog = catalog or inspect_catalog(git_root)
    return catalog.owner(target) or catalog.default()


def discover_components(git_root: str | Path) -> list[Component]:
    return list(inspect_catalog(git_root).components)


def find_agents_md(repo_dir: str | Path, repo_code_dir: str | Path | None = None) -> str | None:
    """Locate AGENTS.md. Prefer repo_code_dir, fallback to repo_dir."""
    candidates = []
    if repo_code_dir:
        candidates.append(Path(repo_code_dir) / "AGENTS.md")
    candidates.append(Path(repo_dir) / "AGENTS.md")
    for c in candidates:
        if c.exists():
            return str(c.resolve())
    return None


def expand_user_path(path: str) -> str:
    """Expand ~ and env vars in a config path."""
    return os.path.expanduser(os.path.expandvars(path))

"""repo_dir / repo_code_dir / language / AGENTS.md location helpers.

Repository discovery and organization come from repocli.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from repocli import InspectReport

from lib import repocli
from repocli.git_state import find_checkout


@dataclass(frozen=True)
class Component:
    """Repocli Component metadata with devloop-owned execution behavior.

    id is the checkout-relative root used by validation stamps; name is the
    repository identity supplied by repocli. Neither discovery nor language
    inference belongs to this wrapper. at() constructs an explicit test/task
    target; inspect_catalog() constructs discovered components.
    """
    path: str
    id: str
    language: str | None = None
    name: str = ""
    package_tools: tuple[repocli.PackageTool, ...] = ()

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

    def has_target(self, name: str, *, suffix: bool = False) -> bool:
        """本 component 的 Makefile 是否有名为 `name` 的 target。suffix=True 时 `name-ci` /
        `name-local` 也算命中（用于「有没有这类目标」的宽判）。"""
        mk = Path(self.path) / "Makefile"
        if not mk.exists():
            return False
        pattern = re.compile(rf"{re.escape(name)}(?:-\w+)?" if suffix else re.escape(name))
        try:
            text = mk.read_text(encoding="utf-8").replace("\\\n", " ")
        except OSError:
            return False
        for line in text.splitlines():
            if line.startswith("\t"):
                continue
            header, separator, rest = line.split("#", 1)[0].partition(":")
            if not separator or "=" in header or rest.startswith("="):
                continue
            if any(pattern.fullmatch(target) for target in header.split()):
                return True
        return False

    def lint_target(self) -> str | None:
        """要跑的 lint target：`lint-ci` > `lint`。`lint-ci` 通常先 `uv sync` 钉版工具链，
        跑 plain `lint` 用本地新版 formatter 会本地过、CI 挂；有 lint-ci 就用它与 CI 对齐。
        无 → None（无 lint 目标，干净跳过）。"""
        for t in ("lint-ci", "lint"):
            if self.has_target(t):
                return t
        return None

    def test_target(self) -> str | None:
        """要跑的 test target：`test` > `test-ci` > `test-local`。**探测即执行**——返回真正
        存在的目标名，判据与执行对齐（旧代码判「有测试」用宽判、却硬跑 `make test`，只有
        `test-ci` 的仓会误判成有测试再报错）。无 → None（干净跳过）。"""
        for t in ("test", "test-ci", "test-local"):
            if self.has_target(t):
                return t
        return None

    def test_command(self) -> tuple[str, ...] | None:
        """只执行项目声明的测试入口；缺少入口由 validation 提示，不猜测生态命令。"""
        target = self.test_target()
        return ("make", target) if target is not None else None

    def supports_lint_files(self) -> bool:
        """项目显式采用 LINT_FILES 契约：fix 和 lint 均支持调用方指定的文件范围。"""
        try:
            makefile = (Path(self.path) / "Makefile").read_text(encoding="utf-8")
        except OSError:
            return False
        return bool(re.search(r"\$\(LINT_FILES\)|\$\{LINT_FILES\}", makefile))

    def focused_lint_command(self, files: list[str], *, target: str | None = None) -> tuple[str, ...] | None:
        """通过项目 Makefile 按文件校验；无法安全表达范围时返回 None，调用方跑全量。"""
        target = target or self.lint_target()
        if target is None or not files or not self.supports_lint_files():
            return None
        # Make 会再次展开变量，recipe 还会经过 shell；argv list 本身不足以隔离文件名。
        if any(not re.fullmatch(r"[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*", path) for path in files):
            return None
        return ("make", target, f"LINT_FILES={' '.join(files)}")

    def supports_test_files(self) -> bool:
        """Makefile 是否显式把 `TEST_FILES` 交给 test runner。"""
        try:
            makefile = (Path(self.path) / "Makefile").read_text(encoding="utf-8")
        except OSError:
            return False
        return bool(re.search(r"\$\(TEST_FILES\)|\$\{TEST_FILES\}", makefile))

    def focused_test_command(self, test_files: list[str]) -> tuple[str, ...] | None:
        """项目显式采用 `TEST_FILES` Make 契约时，构造按测试文件收窄的命令。

        不从 target 名或测试框架猜支持能力：Makefile 没出现 `TEST_FILES` 就回退全量；路径含 shell
        元字符或空白也回退，避免把 git 文件名变成 recipe 注入面。
        """
        target = self.test_target()
        if target is None or not test_files:
            return None
        if any(not re.fullmatch(r"[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*", path) for path in test_files):
            return None
        if not self.supports_test_files():
            return None
        return ("make", target, f"TEST_FILES={' '.join(test_files)}")


def find_git_root(cwd: str | Path) -> str | None:
    """No checkout is None; failed discovery remains an error for caller policy."""
    return find_checkout(cwd)


def is_git_repo(path: str | Path) -> bool:
    return find_git_root(path) is not None


@dataclass(frozen=True)
class Catalog:
    """One inspection, reused for every path in a selection or fingerprint."""
    root: Path
    components: tuple[Component, ...]
    report: InspectReport

    def owner(self, target: str | Path) -> Component | None:
        path = Path(os.path.abspath(target))
        if not path.is_relative_to(self.root):
            return None
        binding = repocli.owner(self.report, path.relative_to(self.root).as_posix())
        return next((c for c in self.components if binding and c.id == binding.root), None)

    def default(self) -> Component:
        # This is execution selection, not discovery or a claim of file ownership.
        for preferred in ("server", "backend", "."):
            if component := next((c for c in self.components if c.id == preferred), None):
                return component
        if len(self.components) == 1:
            return self.components[0]
        raise repocli.InspectionError("no default Component; select a discovered component explicitly")


def inspect_catalog(git_root: str | Path) -> Catalog:
    root = Path(git_root).resolve()
    report = repocli.inspect(str(root))
    components = tuple(Component(str(root / item.root), item.root, item.language, item.name, item.package_tools)
                       for item in report.components)
    return Catalog(root, components, report)


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

"""工具链生态注册表：devloop 认识哪些生态，这个目录就是答案（加生态 = 加文件 + 注册一行）。

Component 与工具证据来自 repocli；本模块决定环境准备和测试回退命令。
契约与边界（make-first、两不变量）见 `base.py`。
"""
from __future__ import annotations

import subprocess
import threading
from pathlib import Path
from repocli import PackageTool

from .base import Ecosystem
from .golang import GoEcosystem
from .node import NodeEcosystem
from .python_uv import PythonEcosystem

# Registry keys select execution adapters; their order does not classify repositories.
ECOSYSTEMS: tuple[Ecosystem, ...] = (PythonEcosystem(), GoEcosystem(), NodeEcosystem())

_PREPARE_TIMEOUT = 600   # 冷 cache 的首次 install 可达分钟级；到顶仍不结束按环境错误报
_LOCKS_GUARD = threading.Lock()
_READY_LOCKS: dict[str, threading.Lock] = {}


def _ready_lock(path: str | Path) -> threading.Lock:
    """同一进程内每个 component 一把 single-flight 锁。

    lifecycle 会并发跑 lint/test；两边同时发现冷环境时，不能并发写同一份 node_modules/.venv。
    锁内必须重查 ready：先拿锁的一方 prepare 完，后拿锁的一方应直接返回。
    """
    key = str(Path(path).resolve())
    with _LOCKS_GUARD:
        return _READY_LOCKS.setdefault(key, threading.Lock())


def detect(path: str | Path, language: str | None = None) -> Ecosystem | None:
    """Select execution fallback from declared language, never reclassify the Component."""
    if language is None:
        from repocli import inspect, owner
        report = inspect(path)
        binding = owner(report, Path(path).resolve().relative_to(Path(report.checkout)).as_posix())
        language = binding.language if binding else None
    name = "node" if language in ("javascript", "typescript", "tsx", "jsx") else language
    return next((eco for eco in ECOSYSTEMS if eco.name == name), None)


def _ensure_ready(path: str | Path, eco: Ecosystem) -> str | None:
    """把 `path` 的依赖环境带到就绪态（自愈式）：就绪/无从判断 → None；不就绪 → 跑一次
    生态 prepare（frozen 语义），成功盖指纹返回 None，失败返回原因（**环境错误**——消费方
    要把它与代码检查失败区分呈现，否则 agent 会去改代码修一个环境问题）。

    worktree 创建（worktree）与 gate（lifecycle.checks）共用这一个入口——
    正常路径与守卫路径必须是同一份策略。"""
    with _ready_lock(path):
        problem = eco.env_problem(path)
        if problem is None:
            return None
        cmd = eco.prepare_command(path)
        if cmd is None:
            return problem   # 确定有病但没有 frozen 恢复路径（如 Node 仓没 lockfile）
        try:
            r = subprocess.run(cmd, cwd=str(path), capture_output=True, text=True,
                               timeout=_PREPARE_TIMEOUT)
        except (OSError, subprocess.TimeoutExpired) as e:
            return f"{problem}; auto-prepare `{' '.join(cmd)}` did not run: {e}"
        if r.returncode != 0:
            tail = "\n".join((r.stdout + r.stderr).splitlines()[-15:])
            return f"{problem}; auto-prepare `{' '.join(cmd)}` failed (rc={r.returncode}):\n{tail}"
        try:
            eco.mark_prepared(path)
        except OSError as e:
            return f"auto-prepare `{' '.join(cmd)}` passed but its environment fingerprint could not be written: {e}"
        if remaining := eco.env_problem(path):
            return f"auto-prepare `{' '.join(cmd)}` passed but the environment is still not ready: {remaining}"
        return None


def ensure_ready(path: str | Path, language: str | None = None, package_tools: tuple[PackageTool, ...] | None = None) -> str | None:
    """Prepare observed tools; a declared Node manager wins over stale lockfiles."""
    if package_tools is None:
        from repocli import inspect, owner
        try:
            report = inspect(path)
            binding = owner(report, Path(path).resolve().relative_to(Path(report.checkout)).as_posix())
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            return f"cannot inspect execution tools: {exc}"
        package_tools = binding.package_tools if binding else ()
        language = language or (binding.language if binding else None)
    candidates = [tool for tool in package_tools if tool.name in {"npm", "pnpm", "yarn", "bun"}]
    declared = [tool for tool in candidates if any(e.endswith("#packageManager") for e in tool.evidence)]
    candidates = declared or candidates
    if len(candidates) > 1:
        return "ambiguous Node package manager; declare packageManager in package.json"
    adapters = []
    if candidates:
        if candidates[0].name == "bun":
            return "bun environment preparation is not supported"
        adapters.append(NodeEcosystem(candidates[0].name))
    elif language in {"typescript", "javascript", "tsx", "jsx"}:
        adapters.append(NodeEcosystem())
    if any(tool.name == "uv" for tool in package_tools):
        adapters.append(PythonEcosystem())
    for eco in adapters:
        if problem := _ensure_ready(path, eco):
            return problem
    return None

"""生命周期 hook facade 核心：dispatch + 结果类型 + 内置注册表。纯机制。"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from importlib import import_module
from typing import Callable

PHASES = ("pre_commit", "post_commit")

# 内置 hook 注册表：name → "module:function"。**惰性**解析（dispatch 时才 import）：handler
# 模块（domain.lifecycle.review）要 `from domain.lifecycle.base import HookResult`，模块级直接引用会
# 成 import 环。
_BUILTIN: dict[str, str] = {
    "review": "domain.lifecycle.review:review",   # signal hook：后台审全量改动、写 review.json + 有开放 MR 时发评论（挂哪相位由 config 决定）
}

@dataclass(frozen=True)
class BackgroundSpec:
    """signal hook 的下游：一条跑到后台的命令。

    `dispatch` 自己**不能**起它——subprocess 派生的子进程 harness 不跟踪、跑完不会 re-invoke
    会话。故 signal hook 把这条 spec 作为 `HookResult.relay` 返回，由调用方 `commit_flow`
    在所裹的 git 动作后用 `Popen(start_new_session=True)` detach 起（fire-and-forget，结果经
    状态总线下轮浮现，不靠 wake）。
    """
    name: str
    argv: list[str]
    note: str = ""


@dataclass(frozen=True)
class HookResult:
    """一次 hook 执行的结果。三种 hook 模式由两个字段编码（见 docs/lifecycle-hooks.md）：

    - **硬拦截**（gate）：`relay=None, advisory=False`——`ok=False` 阻断 commit/MR。
    - **软提示**（advisory）：`relay=None, advisory=True`——同步跑、本轮可见，但 `ok=False`
      只**通报不阻断**（失败常因基线坏测 / 环境，与本次 diff 无关；真正的判断 CI / 人来做）。
    - **异步信号**（signal，如 review）：`relay=BackgroundSpec`——detach 起后台、永不阻断、下轮浮现。

    `guidance` 与三种模式正交：它只承载当轮应展示的项目接入建议，不参与 `ok` / `proceed`。
    """
    name: str
    ok: bool                              # inline hook 的通过与否；signal hook 恒 True
    summary: str = ""
    relay: BackgroundSpec | None = None   # 非 None = signal hook，由 commit_flow detach 后台下游
    advisory: bool = False                # True = 软提示：ok=False 时通报但不阻断（不进 proceed）
    status: str = ""  # passed / failed / skipped / unavailable; ok remains gate policy
    guidance: tuple[str, ...] = ()        # 成败之外的可行动接入提示；调用入口必须当轮展示

    def __post_init__(self) -> None:
        if not self.status:
            object.__setattr__(self, "status", "passed" if self.ok else "failed")


@dataclass(frozen=True)
class DispatchResult:
    phase: str
    results: list[HookResult]

    @property
    def proceed(self) -> bool:
        """是否放行下一步（commit / mr）。只有**硬拦截** gate 的 fail 才挡；advisory（软提示）与
        signal（异步）永不阻断。"""
        return all(r.ok for r in self.results if not r.advisory and r.relay is None)

    @property
    def failures(self) -> list[HookResult]:
        return [r for r in self.results if not r.ok]

    @property
    def blocking_failures(self) -> list[HookResult]:
        """真正阻断的失败（硬拦截 gate）——用于中止 + 报错详情。"""
        return [r for r in self.results if not r.ok and not r.advisory and r.relay is None]

    @property
    def advisory_failures(self) -> list[HookResult]:
        """软提示的失败——通报但不阻断。"""
        return [r for r in self.results if not r.ok and r.advisory]

    @property
    def to_launch(self) -> list[BackgroundSpec]:
        """需调用方起到后台的 signal 下游。"""
        return [r.relay for r in self.results if r.relay is not None]


def resolve_handler(name: str) -> Callable[..., HookResult] | None:
    """name → handler 可调用（`handler(repo, paths) -> HookResult`）；未注册返回 None。"""
    spec = _BUILTIN.get(name)
    if not spec:
        return None
    mod, fn = spec.split(":", 1)
    return getattr(import_module(mod), fn)


def dispatch(
    phase: str,
    repo: str,
    *,
    paths: list[str] | None = None,
    names: list[str] | None = None,
    registry: dict[str, Callable[..., HookResult]] | None = None,
    max_workers: int = 4,
) -> DispatchResult:
    """Dispatch configured lifecycle actions; validation checks are explicit CLI operations.

    Only registered actions execute. Validation belongs to the explicit repocli CLI.
    """
    if phase not in PHASES:
        raise ValueError(f"unknown lifecycle phase: {phase!r} (one of {PHASES})")
    if names is None:
        from domain import config
        names = list(config.lifecycle(repo).get(phase) or [])
    if not names:
        return DispatchResult(phase=phase, results=[])

    def _run(name: str) -> HookResult:
        handler = (registry or {}).get(name) or resolve_handler(name)
        if handler is None:
            return HookResult(name, False, summary=f"unknown lifecycle hook {name!r}")
        try:
            return handler(repo, paths=paths)
        except Exception as exc:
            return HookResult(name, False, summary=f"{name} errored: {exc}")

    with ThreadPoolExecutor(max_workers=max(1, min(max_workers, len(names)))) as executor:
        results = list(executor.map(_run, names))
    return DispatchResult(phase=phase, results=results)

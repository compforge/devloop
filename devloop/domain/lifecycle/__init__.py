"""devops 生命周期 hook 子系统 —— pre_commit / post_commit / pre_mr / post_mr。

**为什么是一个独立子系统（包）。** lint / test / code-review /（将来）e2e·eval·perf
verdict 形状相同——都是「在某个 git 生命周期相位触发的一个验证 / 动作」。过去各自 ad-hoc
接线（lint 的 gate 是一条 PreToolUse 规则、手动 lint 是另一条入口…）。CC 原生事件只到工具层
（`PreToolUse(Bash)` 命令字符串），**git 生命周期这个 altitude 没有原生事件**，故这是一个
正当的「缺失缝」——与 `lib/forge`（评审平台 facade）同性质，不是重造原生事件。

包内分工：
- `base.py`  —— facade 核心：`dispatch` + `HookResult` / `BackgroundSpec` / `DispatchResult`
  + 内置 hook 注册表。纯机制。
- `checks.py` —— Component normalize + 内置 `lint` / `test` checks，与 validate skill 共用同一段
  逻辑、同处盖 `.devloop` validation 戳（单一事实源，不漂移）。
- （MR2）`review.py` —— code-review 的 signal handler，返回带 `relay` 的 HookResult。

**模型**（详见 `docs/lifecycle-hooks.md`）：

- **hook 只有一种，都是阻塞的**。有 lint check 时先 normalize，再并发起相位上的全部 hook、
  join 等全部返回并聚合（`normalize → lint ‖ test`）。
- **「非阻塞」不是 hook 的属性**，而是某个 hook 体只描述异步下游：它返回一个 `relay`
  （`BackgroundSpec`）。`dispatch` 自身永远同步，只收集 relay；调用方在 git 动作完成后
  detach 执行，结果写入结构化状态或外部系统，由下一轮 Board 或 Baton/reqloop 观察。
- **veto 能力与同步性同源**：inline 干活的 hook 返回 `ok=False` 可挡（gate）；只发信号的
  hook 恒 `ok=True` 且带 `relay`（信号发成功就是过，真活还没跑、无可 veto）。

「哪个相位挂哪些 hook」是 `config.lifecycle()` 的数据（opt-in，默认全空 = 每相位 no-op）。
"""
from __future__ import annotations

from .base import (
    PHASES,
    BackgroundSpec,
    DispatchResult,
    HookResult,
    dispatch,
    resolve_handler,
)

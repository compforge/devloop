"""Execution adapters consume repocli Component and package-tool evidence.

They prepare checkout-local dependencies and provide Make-first fallback commands.
Repository identity and language inference belong to repocli.
"""
from __future__ import annotations

from pathlib import Path


class Ecosystem:
    """一个工具链生态。子类只覆写与自己相关的方法；默认值都是"无此事实"的中性答案。

    环境两不变量（`env_problem` / `prepare_command` 服务于它们，详见 docs/worktree-env.md）：
    1. **归属**：验证进程解析到的依赖必须来自本 checkout（防仓内 worktree 向上解析、
       VIRTUAL_ENV 残留这类静默泄漏——它们不报错，但跑的是别的 checkout 的依赖/代码）；
    2. **一致**：依赖内容与本 checkout 的 lockfile 一致，且 prepare 用 frozen 语义、
       绝不改 lockfile（gate 只验证、不变更）。
    """

    name: str = ""


    def prepare_command(self, path: str | Path) -> list[str] | None:
        """把 `path` 的依赖环境从 lockfile 恢复出来的确定性命令（frozen 语义）。
        None = 本生态无需/无法准备（Go 全局 module cache；无 lockfile 的 Node 仓不猜）。"""
        return None

    def env_problem(self, path: str | Path) -> str | None:
        """`path` 的依赖环境**不就绪**的原因；None = 就绪。

        刻意 fail-open：只报"确定有问题"（环境目录整个缺失、devloop 自己盖的 lockfile 指纹
        对不上），不报"无法确认"——主 checkout 的环境是用户自己装的、没有 devloop 指纹，
        把它判成 not-ready 会逼每个仓重装一遍。"""
        return None

    def mark_prepared(self, path: str | Path) -> None:
        """prepare 成功后盖指纹（供 `env_problem` 校验一致性）。默认无指纹可盖。"""

    def fallback_test_command(self, path: str | Path) -> tuple[str, ...] | None:
        """无 Makefile 时本生态的 canonical test 命令（如 `go test ./...`）。默认没有。"""
        return None

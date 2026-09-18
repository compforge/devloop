#!/usr/bin/env python3
"""validate skill 的 lint-check 入口：按改动范围 normalize/lint；仅全量通过盖 lint 戳。

normalize/lint 逻辑见 `domain.lifecycle.checks`（与 lifecycle pre_commit gate 是同一段）。本脚本
只做 repo 解析、顺序编排、实时输出和退出码。只有 `make fix` 能自动改文件。

Usage: run_lint.py [--repo R | R] [--full]   (R = 路径或 workspace 子项目名；
默认 = cwd 的 repo，回退到 workspace 最近活跃 repo)
Exit: 0 通过或干净跳过；1 lint 失败（输出已显示）。
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from domain import repo as repo_model  # noqa: E402
from lib import cli  # noqa: E402
from domain.context import record_active_repo  # noqa: E402
from domain.lifecycle import checks  # noqa: E402


def main(argv: list[str]) -> int:
    ap = cli.ArgParser(prog="run_lint.py", description="normalize + lint check; stamp on pass.")
    ap.add_argument("--full", action="store_true", help="check full Components even when files have changed")
    cli.add_repo_arg(ap)
    ns = ap.parse_args(argv)
    resolved, how = cli.resolve_repo_or_exit(ns, "run_lint")
    repo = resolved.git_root
    ws = repo_model.select_components(repo, explicit=resolved.target_path)
    if how != "cwd":
        print(f"run_lint: repo = {repo} ({how})")
    # 每次执行前自述本轮 component 与选择原因——目标选错要一眼可见。
    names = ", ".join(Path(u.path).name for u in ws.components)
    print(f"run_lint: components = {names}  [{ws.reason}]")
    record_active_repo(repo)

    results = checks.validate_components(repo, ws, names=("lint",), full=ns.full,
        explicit=bool(resolved.target_path and Path(resolved.target_path).resolve() != Path(repo).resolve()),
        extra=None)
    for result in results:
        print(("✓ " if result.ok else "✗ ") + result.summary)
        for guidance in result.guidance:
            print(f"  - {guidance}")
    return 0 if all(result.ok for result in results) else 1



if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

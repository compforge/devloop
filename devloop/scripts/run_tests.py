#!/usr/bin/env python3
"""validate skill 的 behavior-check 入口：跑各 Component 的 canonical test，通过则盖 test 戳。

test 逻辑见 `domain.lifecycle.checks.test`（与 lifecycle 的 pre_commit / pre_mr gate 是同一段）。
本脚本只做 repo 解析 + 实时输出 + 退出码，并把 working-tree 改动范围交给公共 test check；
`--` 之后的显式参数优先，由调用者手动决定收窄方式。

Usage: run_tests.py [--repo R | R] [--full] [-- <额外 make/test 参数>]
(R = 路径或 workspace 子项目名；默认 = cwd 的 repo，回退到 workspace 最近活跃 repo。)
Exit: 0 通过或跳过；1 失败。
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
    extra: list[str] = []
    if "--" in argv:
        i = argv.index("--")
        extra = argv[i + 1:]
        argv = argv[:i]
    ap = cli.ArgParser(prog="run_tests.py", description="run component tests; stamp on pass.")
    cli.add_repo_arg(ap)
    ap.add_argument("--full", action="store_true",
                    help="run the full suite in each selected Component")
    ns = ap.parse_args(argv)
    if ns.full and extra:
        ap.error("--full cannot be combined with extra test arguments after --")
    resolved, how = cli.resolve_repo_or_exit(ns, "run_tests")
    repo = resolved.git_root
    ws = repo_model.select_components(repo, explicit=resolved.target_path)
    if how != "cwd":
        print(f"run_tests: repo = {repo} ({how})")
    # 每次执行前自述本轮 component 与选择原因——目标选错要一眼可见，不用等错测试跑完再猜。
    names = ", ".join(Path(u.path).name for u in ws.components)
    print(f"run_tests: components = {names}  [{ws.reason}]")
    record_active_repo(repo)

    results = checks.validate_components(repo, ws, names=("test",), full=ns.full,
        explicit=bool(resolved.target_path and Path(resolved.target_path).resolve() != Path(repo).resolve()),
        extra=extra)
    for result in results:
        print(("✓ " if result.ok else "✗ ") + result.summary)
        for guidance in result.guidance:
            print(f"  - {guidance}")
    return 0 if all(result.ok for result in results) else 1



if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

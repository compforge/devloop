#!/usr/bin/env python3
"""Python skill workflow 测试入口：`python3 devloop/scripts/tests/run_all.py`。

逐模块跑所有 test_*.py（test_session_lock.py 用 pytest fixture，只归 pytest 跑）。
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _testkit import run_all  # noqa: E402  (bootstrap first)

MODULES = [
    "test_config",
    "test_forge",
    "test_pr",
    "test_git_ops",
    "test_worktree",
    "test_tasks",
    "test_rebase",
    "test_session",
    "test_board",
    "test_focused_lint",
    "test_test_scope",
    "test_review",
]


def main() -> int:
    total, failed = 0, []
    for name in MODULES:
        n, bad = run_all(vars(importlib.import_module(name)), label=name)
        total += n
        failed += bad
    print("TOTAL:", "FAIL " + ", ".join(failed) if failed else f"ALL PASS ({total} tests)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

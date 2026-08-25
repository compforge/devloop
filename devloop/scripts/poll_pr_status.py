#!/usr/bin/env python3
"""Compatibility adapter for the shared ``pr-lifecycle-reconcile`` task.

New integrations should discover tasks through ``scripts/run_task.py list`` and
run this task through ``scripts/run_task.py run``. The historical CLI remains:

``poll_pr_status.py <target>`` repeats for Claude monitor compatibility;
``poll_pr_status.py <target> --once [--report]`` runs one sweep.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from scripts import run_task  # noqa: E402
from tasks.pr_lifecycle import repos_for_target as repos_to_poll  # noqa: E402, F401
from tasks.pr_lifecycle import sweep_repo  # noqa: E402, F401


def main(argv: list[str]) -> int:
    once = "--once" in argv
    translated = [arg for arg in argv if arg != "--once"]
    if not once:
        translated.append("--loop")
    return run_task.main(["run", "pr-lifecycle-reconcile", *translated])


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

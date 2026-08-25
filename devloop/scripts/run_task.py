#!/usr/bin/env python3
"""Discover and run one devloop task for a Harness-specific adapter."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLUGIN_ROOT))

from tasks import registry  # noqa: E402


def main(argv: list[str]) -> int:
    if argv and argv[0] == "list":
        specs = registry.discover().values()
        print(json.dumps([spec.__dict__ for spec in specs], ensure_ascii=False, sort_keys=True))
        return 0
    if len(argv) < 2 or argv[0] != "run":
        print("usage: run_task.py list | run <task> [target] [--loop] [--report]", file=sys.stderr)
        return 2

    name = argv[1]
    loop = "--loop" in argv
    report = "--report" in argv
    positional = [arg for arg in argv[2:] if arg not in {"--loop", "--report"}]
    target = positional[0] if positional else "."
    try:
        spec = registry.discover()[name]
    except KeyError:
        print(f"unknown devloop task: {name}", file=sys.stderr)
        return 2

    while True:
        result = {"task": name, "repositories": registry.run(name, target)}
        if report:
            print(json.dumps(result, ensure_ascii=False, sort_keys=True), flush=True)
        if not loop:
            return 0
        time.sleep(spec.interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

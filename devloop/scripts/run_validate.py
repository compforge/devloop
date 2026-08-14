#!/usr/bin/env python3
"""validate skill 的完整入口：normalize 后并发执行 lint/test checks，聚合 Component 结果。"""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from domain import repo as repo_model  # noqa: E402
from domain.context import record_active_repo  # noqa: E402
from domain.lifecycle import checks  # noqa: E402
from lib import cli  # noqa: E402


def main(argv: list[str]) -> int:
    ap = cli.ArgParser(
        prog="run_validate.py",
        description="normalize, then run Component validation checks.",
    )
    cli.add_repo_arg(ap)
    ns = ap.parse_args(argv)
    resolved, how = cli.resolve_repo_or_exit(ns, "run_validate")
    repo = resolved.git_root
    workset = repo_model.select_components(repo, explicit=resolved.target_path)
    if how != "cwd":
        print(f"run_validate: repo = {repo} ({how})")
    names = ", ".join(Path(component.path).name for component in workset.components)
    print(f"run_validate: components = {names}  [{workset.reason}]")
    record_active_repo(repo)

    ok = True
    for component in workset.components:
        prepared = checks.normalize(repo, capture=False, component=component)
        if not prepared.ok:
            print("✗ " + prepared.summary)
            ok = False
            continue
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(checks.lint, repo, component=component),
                executor.submit(checks.test, repo, component=component),
            ]
            results = [future.result() for future in futures]
        for result in results:
            print(("✓ " if result.ok else "✗ ") + result.summary)
            for guidance in result.guidance:
                print(f"  - {guidance}")
            ok = ok and result.ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

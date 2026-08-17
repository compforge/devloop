#!/usr/bin/env python3
"""Start new work on a fresh, owned development branch."""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from domain import branch as branch_domain, repo as repo_model  # noqa: E402
from domain.context import record_active_repo  # noqa: E402
from lib import cli, git_state  # noqa: E402


def _build_parser() -> cli.ArgParser:
    ap = cli.ArgParser(description="Start new work on a branch created from a fresh baseline.")
    sub = ap.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create", help="create and switch to a new development branch")
    create.add_argument("name", help="new branch name")
    create.add_argument("--target", "-t", default=None, help="target branch (default: repository trunk)")
    create.add_argument(
        "--base",
        default=None,
        help="base ref (default: origin/<target>; use a feature ref only for intentional stacking)",
    )
    create.add_argument(
        "--carry-changes",
        action="store_true",
        help="move current tracked and untracked changes onto the new branch",
    )
    cli.add_repo_arg(create, positional=False)
    return ap


def main(argv: list[str]) -> int:
    ap = _build_parser()
    ns = ap.parse_args(argv)
    resolved, source = repo_model.resolve_repo_dir(ns.repo, os.getcwd())
    if not resolved:
        print(f"branch: {source}", file=sys.stderr)
        return 1
    repo = resolved.git_root
    record_active_repo(repo)
    target = ns.target or git_state.local_default_target(repo)
    base = ns.base or f"origin/{target}"
    plan = [
        f"action=branch-create repo={Path(repo).name} ({source}) "
        f"branch={ns.name} base={base}"
    ]
    try:
        result = branch_domain.create(
            repo,
            ns.name,
            base,
            carry_changes=ns.carry_changes,
        )
    except branch_domain.BranchError as exc:
        _banner(plan)
        print(f"\n✗ {exc}", file=sys.stderr)
        return 1

    if result.created:
        carried = " (carried local changes)" if result.carried_changes else ""
        plan.append(f"cut new branch {result.name!r} off {result.base}{carried}")
        plan.append(f"recorded fork_from={result.fork_from}")
    else:
        plan.append(f"already on branch {result.name!r}; kept existing branch")
    _banner(plan)
    return 0


def _banner(plan: list[str]) -> None:
    print("PLAN:")
    for line in plan:
        print(f"  - {line}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

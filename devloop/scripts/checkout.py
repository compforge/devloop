#!/usr/bin/env python3
"""Resolve a repo target and optionally create or resume a managed worktree.

Output protocol (first line):
  MATCH<TAB><absolute_path>
  CANDIDATES<TAB><name1>\\t<path1>\\t<name2>\\t<path2>...
  NONE<TAB><reason>
Exit codes: 0 single match; 2 multiple candidates; 1 no match / error.
"""
from __future__ import annotations

import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLUGIN_ROOT))

from lib import cli  # noqa: E402
from domain.forge import ForgeError  # noqa: E402
from domain import repo as repo_model, worktree  # noqa: E402


def emit(line: str, code: int) -> int:
    print(line)
    return code


def parse_args(argv: list[str]):
    ap = cli.ArgParser(description="Select a repository or create/resume a managed worktree.")
    ap.add_argument("query", nargs="*")
    ap.add_argument("--worktree")
    ap.add_argument("--target-repo", choices=["current", "parent"], default=None)
    ns = ap.parse_args(argv[1:])
    if ns.target_repo is not None and not ns.worktree:
        ap.error("--target-repo requires --worktree")
    return " ".join(ns.query).strip() or None, ns.worktree, ns.target_repo


def resolve_base(query: str) -> tuple[str | None, int, str]:
    """Adapt the shared resolver result to this script's stable line protocol."""
    result = repo_model.resolve_repo_target(query)
    if result.path:
        return result.path, 0, ""
    if result.candidates:
        parts = [value for candidate in result.candidates for value in candidate]
        return None, 2, "CANDIDATES\t" + "\t".join(parts)
    return None, 1, f"NONE\t{result.reason}"


def main(argv: list[str]) -> int:
    query, tag, target_repo = parse_args(argv)
    if not query:
        return emit("NONE\tno argument given", 1)
    path, code, line = resolve_base(query)
    if path is None:
        return emit(line, code)
    if tag:
        try:
            managed_path, message = worktree.create_or_reuse(path, tag, target_repo=target_repo)
        except (ForgeError, OSError) as exc:
            return emit(f"NONE\t{exc}", 1)
        if managed_path is None:
            return emit(f"NONE\t{message}", 1)
        print(f"MATCH\t{managed_path}")
        print(f"INFO\t{message}")
        return 0
    return emit(f"MATCH\t{path}", 0)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

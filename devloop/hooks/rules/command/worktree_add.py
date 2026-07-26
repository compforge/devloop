"""Block unmanaged ``git worktree add`` and route creation through devloop."""
from __future__ import annotations

from pathlib import Path

from domain import repo_layout
from lib import git_state
from hooks.core.domain import Command, Finding, Severity, TargetKind
from hooks.core.protocol import Rule


class WorktreeAddRule(Rule):
    name = "worktree-add"
    target_kind = TargetKind.COMMAND

    def applies(self, target: Command, ctx) -> bool:
        return target.subcommand == "worktree" and bool(target.args) and target.args[0] == "add"

    def check(self, target: Command, ctx) -> list[Finding]:
        run_dir = target.working_dir.path
        git_root = repo_layout.find_git_root(run_dir) if run_dir is not None else None
        worktrees = git_state.list_worktrees(git_root) if git_root else []
        primary = worktrees[0][0] if worktrees else git_root
        repo = Path(primary).name if primary else "<repo>"
        return [
            Finding(
                rule=self.name,
                severity=Severity.DENY,
                message=(
                    "Direct `git worktree add` bypasses devloop's managed worktree lifecycle "
                    "(canonical location, base branch, reuse/pruning, and dependency preparation).\n"
                    f"Use the managed-worktree helper with a short unique tag: "
                    f"`python3 \"<PLUGIN_ROOT>/scripts/checkout.py\" {repo} --worktree <tag>`. "
                    "The checkout helper delegates creation to `domain/worktree.py`."
                ),
                locator=" ".join(target.argv),
            )
        ]

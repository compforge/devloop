"""Managed git worktree lifecycle used by the explicit worktree helper.

RepoKit selects the checkout path from the requested repository and name. Keeping creation,
reuse and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from repokit.cli import run as _repocli
from repokit.cli import worktree_result
from repokit.git.state import checkout_info

from domain import git_policy

logger = logging.getLogger(__name__)


def create_or_reuse(repo_dir: str, tag: str) -> tuple[str | None, str]:
    """Choose task naming and preparation policy over RepoKit checkout placement and lifecycle.

    +spec=Only a confirmed matching CLI result authorizes preparation; failure/unknown never falls back to SDK mutation.
    +link=component://devloop/skills/git-ops/references/worktree.md#dependency-preparation
    """
    branch = f"worktree-{tag}"
    try:
        base = git_policy.local_default_target(repo_dir)
        envelope = _repocli(repo_dir, ("worktree", "ensure"), [
            tag, "--branch", branch, "--base", base, "--remote", "origin", "--prepare",
        ], timeout=720)
        if envelope["outcome"] not in {"succeeded", "partial"}:
            error = envelope.get("error")
            detail = error.get("message") if isinstance(error, dict) else None
            return None, f"worktree ensure {envelope['outcome']}: {detail or 'inspect the CLI result before retrying'}"
        data = envelope.get("data")
        if not isinstance(data, dict) or data.get("name") != tag:
            raise ValueError("mismatching worktree name")
        checkout = data.get("checkout")
        if not isinstance(checkout, str) or not Path(checkout).is_absolute():
            raise ValueError("invalid checkout path")
        data = worktree_result(envelope, Path(checkout), branch, prepared=True)
        diagnostics = data["diagnostics"]
        warnings = [d["message"] for d in diagnostics]
        checkout = data["checkout"]
        preparation = data.get("preparation")
        if not data["ready"]:
            error = envelope.get("error") or {}
            warnings.append(error.get("message") or "dependencies are not verified ready; inspect preparation bins")
            for bin in preparation.get("bins", []):
                if bin.get("status") != "ready":
                    reason = (bin.get("error") or {}).get("message") or bin.get("reason") or bin.get("status")
                    warnings.append(f"{bin.get('path')}: {reason}; {bin.get('stderr', '')}".strip())
        message = {"created": f"created worktree from refreshed origin/{base}",
                   "resumed": "reused existing branch", "reused": "reused existing worktree"}[data["action"]]
        if warnings:
            message += "; environment warning: " + " | ".join(warnings)
        return checkout, message
    except (OSError, ValueError, KeyError, TypeError, AttributeError,
            subprocess.SubprocessError) as error:
        return None, f"worktree ensure unavailable: {error}"




def primary(repo_dir: str) -> str:
    """Return the stable primary checkout used to mutate linked-worktree metadata."""
    info = checkout_info(repo_dir)
    return info.main_root or info.root

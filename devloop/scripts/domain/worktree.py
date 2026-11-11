"""Managed git worktree lifecycle used by the explicit worktree helper.

All devloop-created worktrees live below ``<repo>/.worktrees/``. Keeping creation,
reuse and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from repokit.git.state import checkout_info

from domain import git_policy
from command import run_repocli as _repocli

logger = logging.getLogger(__name__)


def prepare_environment(path: str) -> list[str]:
    """Prepare once per checkout; preparation warnings never undo worktree creation.

    +spec=RepoCLI owns Bin selection and installation; unavailable results warn without SDK fallback.
    +link=component://devloop/docs/worktree-env.md
    """
    try:
        envelope = _repocli(path, ("depot", "prepare"), [], timeout=600)
        data = envelope["data"]
        if envelope["outcome"] != "succeeded" and isinstance(data, dict) and not data.get("checkout"):
            error = envelope.get("error")
            if isinstance(error, dict) and isinstance(error.get("message"), str):
                return [error["message"]]
        if (not isinstance(data, dict) or not isinstance(data.get("checkout"), str)
                or Path(data["checkout"]).resolve() != Path(path).resolve()
                or type(data.get("complete")) is not bool or not isinstance(data.get("bins"), list)):
            raise ValueError("invalid Depot report or checkout")
        warnings = []
        seen = set()
        for bin in data["bins"]:
            name, status, action = bin["path"], bin["status"], bin.get("action", "")
            if (not isinstance(name, str) or not name or name in seen
                    or status not in {"ready", "present", "missing", "stale", "unsupported", "unknown"}
                    or action not in {"", "reused", "preserved", "prepared", "unsupported",
                                      "failed", "uncertain", "not_run"}):
                raise ValueError("invalid Bin result")
            seen.add(name)
            reason = bin.get("reason", "")
            detail = bin.get("stderr", "").strip() or bin.get("stdout", "").strip()
            if not isinstance(reason, str):
                raise ValueError("invalid Bin reason")
            issue = bin.get("error")
            if issue is not None:
                if not isinstance(issue, dict) or not isinstance(issue.get("message"), str):
                    raise ValueError("invalid Bin error")
                reason = issue["message"]
            if not issue and (status, action) in {("ready", "prepared"), ("ready", "reused")}:
                continue
            if not issue and (status, action) == ("present", "preserved"):
                logger.warning("Dependency Bin preserved without readiness evidence path=%s bin=%s", path, name)
                continue
            warnings.append(f"Bin {name}: {action or status}: {reason}"
                            + (f"\n{detail[-4000:]}" if detail else ""))
        if envelope["outcome"] == "succeeded" and (not data["complete"] or warnings):
            raise ValueError("successful envelope contradicts Depot results")
        if envelope["outcome"] != "succeeded" and not warnings:
            error = envelope.get("error")
            if not isinstance(error, dict) or not isinstance(error.get("message"), str):
                raise ValueError("failed Depot report without error")
            warnings.append(error["message"])
        return warnings
    except (OSError, ValueError, KeyError, TypeError, AttributeError,
            subprocess.SubprocessError) as error:
        return [f"dependency preparation unavailable: {error}"]


def create_or_reuse(repo_dir: str, tag: str) -> tuple[str | None, str]:
    """Choose devloop naming and preparation policy over RepoKit checkout lifecycle.

    +spec=Only a confirmed matching CLI result authorizes preparation; failure/unknown never falls back to SDK mutation.
    +link=component://devloop/docs/worktree-env.md
    """
    branch = f"worktree-{tag}"
    target = Path(repo_dir).resolve() / ".worktrees" / tag
    try:
        base = git_policy.local_default_target(repo_dir)
        envelope = _repocli(repo_dir, ("worktree", "ensure"), [
            str(target), "--branch", branch, "--base", base, "--remote", "origin",
        ], timeout=120)
        if envelope["outcome"] != "succeeded":
            error = envelope.get("error")
            detail = error.get("message") if isinstance(error, dict) else None
            return None, f"worktree ensure {envelope['outcome']}: {detail or 'inspect the CLI result before retrying'}"
        data = envelope["data"]
        if (not isinstance(data, dict) or data.get("confirmed") is not True
                or data.get("branch") != branch or not isinstance(data.get("checkout"), str)
                or not data["checkout"] or Path(data["checkout"]).resolve() != target.resolve()
                or not isinstance(data.get("headSha"), str) or not data["headSha"]
                or data.get("action") not in {"created", "resumed", "reused"}):
            raise ValueError("unconfirmed or mismatching checkout result")
        diagnostics = data.get("diagnostics")
        if not isinstance(diagnostics, list) or any(
            not isinstance(d, dict) or not isinstance(d.get("message"), str) for d in diagnostics
        ):
            raise ValueError("invalid checkout diagnostics")
        warnings = [d["message"] for d in diagnostics]
        checkout = data["checkout"]
        warnings.extend(prepare_environment(checkout))
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

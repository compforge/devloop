"""Managed git worktree lifecycle used by the explicit worktree helper.

All devloop-created worktrees live below ``<repo>/.worktrees/``. Keeping creation,
reuse and dependency preparation behind this module prevents callers from
reproducing only the visible ``git worktree add`` step and skipping lifecycle policy.
"""
from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

from repokit import state as operations
from repokit.git import state as git_state
from repokit.git.state import checkout_info
from repokit.state import RepositoryState

from domain import git_policy

logger = logging.getLogger(__name__)


def prepare_environment(path: str) -> list[str]:
    """Prepare once per checkout; preparation warnings never undo worktree creation.

    +spec=RepoCLI owns Bin selection and installation; unavailable results warn without SDK fallback.
    +link=component://devloop/docs/worktree-env.md
    """
    try:
        result = subprocess.run(
            ["repocli", "depot", "prepare", "--repo", path, "--timeout", "10m", "--json"],
            capture_output=True, text=True, timeout=610, check=False,
        )
        envelope = json.loads(result.stdout)
        if (envelope["schemaVersion"] != "1.0"
                or envelope["command"] != "repocli depot prepare"
                or envelope["outcome"] not in {"succeeded", "failed", "partial", "unknown"}
                or (result.returncode == 0) != (envelope["outcome"] == "succeeded")):
            raise ValueError("unsupported or contradictory repocli result")
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
        logger.info("Dependency preparation path=%s outcome=%s bins=%d cost=%s",
                    path, envelope["outcome"], len(data["bins"]), envelope.get("cost"))
        return warnings
    except (OSError, ValueError, KeyError, TypeError, AttributeError,
            subprocess.SubprocessError) as error:
        return [f"dependency preparation unavailable: {error}"]


def create_or_reuse(repo_dir: str, tag: str) -> tuple[str | None, str]:
    """Create or reuse ``.worktrees/<tag>``.

    Worktrees live inside the repo, never as siblings. The legacy ``worktrees/`` layout
    remains readable so existing checkouts continue to resolve. The operation is
    idempotent and prepares dependencies. Reclamation belongs exclusively to PR/MR
    lifecycle reconciliation; creating or resuming a checkout never removes another.
    A genuinely new branch is cut from a freshly fetched ``origin/<target>``. A retained
    branch is resumed as-is: reusing a tag must never rewrite existing work.
    """
    base = Path(repo_dir)
    rel = Path(".worktrees") / tag
    for legacy in (rel, Path("worktrees") / tag):
        if (base / legacy).is_dir():
            path = str((base / legacy).resolve())
            warnings = prepare_environment(path)
            try:
                RepositoryState().observe(path)
            except (OSError, ValueError) as exc:
                logger.warning("Worktree observation failed path=%s error=%s", path, exc)
                warnings.append(f"repository observation unavailable: {exc}")
            msg = "reused existing worktree"
            if warnings:
                msg += "; environment warning: " + " | ".join(warnings)
            return path, msg

    target = git_policy.local_default_target(repo_dir)
    branch = f"worktree-{tag}"
    if git_state.rev_parse(repo_dir, f"refs/heads/{branch}"):
        result = operations.add_worktree(repo_dir, str(rel), branch)
        message = "reused existing branch"
    else:
        remote_ref = f"origin/{target}"
        refspec = f"+refs/heads/{target}:refs/remotes/origin/{target}"
        if not git_state.fetch(repo_dir, refspec, timeout=30):
            return None, (
                f"could not refresh {remote_ref}; worktree was not created "
                "because its base may be stale"
            )
        if not git_state.rev_parse(repo_dir, remote_ref):
            return None, f"could not resolve refreshed {remote_ref}"
        result = operations.add_worktree(repo_dir, str(rel), remote_ref, branch=branch)
        message = f"created worktree from refreshed {remote_ref}"
    if not result.ok:
        return None, f"worktree add failed for {branch}: {result.detail}"

    path = str((base / rel).resolve())
    warnings = prepare_environment(path)
    if result.err.startswith("checkout created; metadata unavailable:"):
        logger.warning("Worktree created with metadata diagnostic path=%s detail=%s", path, result.err)
        warnings.append(result.err)
    if warnings:
        message += "; environment warning: " + " | ".join(warnings)
    return path, message


def primary(repo_dir: str) -> str:
    """Return the stable primary checkout used to mutate linked-worktree metadata."""
    info = checkout_info(repo_dir)
    return info.main_root or info.root

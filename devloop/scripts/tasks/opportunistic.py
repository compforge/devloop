"""Non-blocking Codex fallback for hosts that cannot register plugin tasks.

Scheduled tasks remain the durable timer. Codex lifecycle hooks call ``maybe_start`` as
an activity heartbeat so the same one-shot reconciliation still runs while the user is
actively coding, without adding forge latency to the foreground hook.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

from domain import worktree
from domain.context import store
from lib import gitcmd

from . import registry

TASK_NAME = "pr-lifecycle-reconcile"


def _claim(path: Path, *, stale_after: int = 60) -> int | None:
    """Acquire a short cross-process spawn claim, recovering an abandoned claim."""
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    for attempt in range(2):
        try:
            return os.open(path, flags, 0o600)
        except FileExistsError:
            try:
                stale = time.time() - path.stat().st_mtime >= stale_after
            except OSError:
                return None
            if not stale or attempt:
                return None
            try:
                path.unlink()
            except OSError:
                return None
        except OSError:
            return None
    return None


def maybe_start(repo_dir: str, *, now: float | None = None) -> bool:
    """Start a throttled reconciliation process and return whether it was launched."""
    control_repo = worktree.primary(repo_dir)
    if not gitcmd.git(control_repo, "remote", "get-url", "origin").ok:
        return False

    spec = registry.discover()[TASK_NAME]
    stamp = store.tmp_dir(control_repo) / f"{TASK_NAME}.opportunistic"
    claim = stamp.with_suffix(".claim")
    try:
        stamp.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        return False
    claim_fd = _claim(claim)
    if claim_fd is None:
        return False

    try:
        current = time.time() if now is None else now
        try:
            if current - stamp.stat().st_mtime < spec.interval_seconds:
                return False
        except FileNotFoundError:
            pass
        except OSError:
            return False

        runner = Path(__file__).resolve().parent.parent / "scripts" / "run_task.py"
        try:
            subprocess.Popen(
                [sys.executable, str(runner), "run", TASK_NAME, control_repo],
                cwd=control_repo,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
                close_fds=True,
            )
        except OSError:
            return False
        try:
            stamp.touch()
            os.utime(stamp, (current, current))
        except OSError:
            pass
        return True
    finally:
        os.close(claim_fd)
        try:
            claim.unlink()
        except OSError:
            pass

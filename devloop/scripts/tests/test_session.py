#!/usr/bin/env python3
"""Cross-Harness checkout ownership shared with the TypeScript runtime."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

from _testkit import run_main  # noqa: E402  (bootstrap first)
from domain.context import session  # noqa: E402


def test_checkout_owner_is_shared_across_harnesses():
    root = Path("/tmp/dlut_cross_harness_owner")
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir()
    assert session.acquire(root, "claude-session", "feature", harness="claude", pid=os.getpid())
    assert session.foreign_owner(root, "codex-session", harness="codex")
    assert not session.acquire(root, "codex-session", "feature", harness="codex", pid=os.getpid())
    assert session.release(root, "claude-session", harness="claude")


if __name__ == "__main__":
    run_main(globals())

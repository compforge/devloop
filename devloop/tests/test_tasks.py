#!/usr/bin/env python3
"""Shared task discovery and Harness adapter contracts."""
from __future__ import annotations

import io
import json
import shutil
from contextlib import redirect_stdout
from pathlib import Path

from _testkit import _load_script, run_main  # noqa: E402  (bootstrap first)
from lib import gitcmd  # noqa: E402
from tasks import opportunistic, pr_lifecycle, registry  # noqa: E402


def test_task_registry_discovers_pr_lifecycle_once():
    tasks = registry.discover()
    assert list(tasks) == ["pr-lifecycle-reconcile"]
    assert tasks["pr-lifecycle-reconcile"].module == "tasks.pr_lifecycle"
    assert tasks["pr-lifecycle-reconcile"].interval_seconds > 0


def test_task_runner_executes_one_shot_and_reports_shared_shape():
    runner = _load_script("run_task")
    original = runner.registry.run
    calls = []
    try:
        runner.registry.run = lambda name, target: calls.append((name, target)) or [{"repo": "/r"}]
        output = io.StringIO()
        with redirect_stdout(output):
            rc = runner.main(["run", "pr-lifecycle-reconcile", "/workspace", "--report"])
    finally:
        runner.registry.run = original

    assert rc == 0
    assert calls == [("pr-lifecycle-reconcile", "/workspace")]
    assert json.loads(output.getvalue()) == {
        "task": "pr-lifecycle-reconcile",
        "repositories": [{"repo": "/r"}],
    }


def test_pr_lifecycle_task_fault_isolates_repositories():
    original_repos = pr_lifecycle.repos_for_target
    original_sweep = pr_lifecycle.sweep_repo
    try:
        pr_lifecycle.repos_for_target = lambda _target: ["/good", "/bad", "/later"]

        def sweep(repo):
            if repo == "/bad":
                raise RuntimeError("offline")
            return {"repo": repo}

        pr_lifecycle.sweep_repo = sweep
        results = pr_lifecycle.run("/workspace")
    finally:
        pr_lifecycle.repos_for_target = original_repos
        pr_lifecycle.sweep_repo = original_sweep

    assert results == [
        {"repo": "/good"},
        {"repo": "/bad", "error": "RuntimeError"},
        {"repo": "/later"},
    ]


def test_codex_opportunistic_reconciliation_is_nonblocking_and_throttled():
    root = Path("/tmp/dlut_opportunistic_task")
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir()
    calls = []
    original_primary = opportunistic.worktree.primary
    original_git = opportunistic.gitcmd.git
    original_discover = opportunistic.registry.discover
    original_popen = opportunistic.subprocess.Popen
    try:
        opportunistic.worktree.primary = lambda _repo: str(root)
        opportunistic.gitcmd.git = lambda *_a, **_kw: gitcmd.GitResult(0, "origin", "")
        opportunistic.registry.discover = lambda: {
            opportunistic.TASK_NAME: registry.TaskSpec(
                name=opportunistic.TASK_NAME,
                module="tasks.pr_lifecycle",
                description="test",
                interval_seconds=120,
            )
        }
        opportunistic.subprocess.Popen = lambda args, **kwargs: calls.append((args, kwargs))

        assert opportunistic.maybe_start(str(root), now=1_000)
        assert not opportunistic.maybe_start(str(root), now=1_119)
        assert opportunistic.maybe_start(str(root), now=1_120)
    finally:
        opportunistic.worktree.primary = original_primary
        opportunistic.gitcmd.git = original_git
        opportunistic.registry.discover = original_discover
        opportunistic.subprocess.Popen = original_popen

    assert len(calls) == 2
    assert calls[0][0][-3:] == ["run", opportunistic.TASK_NAME, str(root)]
    assert calls[0][1]["start_new_session"] is True


if __name__ == "__main__":
    run_main(globals())

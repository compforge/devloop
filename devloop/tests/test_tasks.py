#!/usr/bin/env python3
"""Shared task discovery and Harness adapter contracts."""
from __future__ import annotations

import io
import json
from contextlib import redirect_stdout

from _testkit import _load_script, run_main  # noqa: E402  (bootstrap first)
from tasks import pr_lifecycle, registry  # noqa: E402


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


if __name__ == "__main__":
    run_main(globals())

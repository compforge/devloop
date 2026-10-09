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



def test_repo_heartbeat_does_not_expand_into_containing_workspace():
    from unittest.mock import patch
    with patch.object(pr_lifecycle.repo_layout, "find_git_root", return_value="/repo"), \
         patch.object(pr_lifecycle, "repos_for_target", side_effect=AssertionError("expanded heartbeat")), \
         patch.object(pr_lifecycle, "sweep_repo", return_value={"repo": "/repo"}) as sweep:
        assert pr_lifecycle.run("/repo/subdir", repo_only=True) == [{"repo": "/repo"}]
        sweep.assert_called_once_with("/repo")


def test_task_exit_status_exposes_refresh_and_cleanup_failures():
    from unittest.mock import patch
    runner = _load_script("run_task")
    for row in [
        {"repo": "/repo", "error": "ForgeError"},
        {"repo": "/repo", "updated": {"local_pull_requests": False}},
        {"repo": "/repo", "actions": [{"status": "deferred", "reason": "git_error"}]},
    ]:
        with patch.object(runner.registry, "run", return_value=[row]) as run:
            assert runner.main(["run", "pr-lifecycle-reconcile", "/repo", "--repo-only"]) == 1
            run.assert_called_once_with("pr-lifecycle-reconcile", "/repo", repo_only=True)


def test_real_sweep_reclaims_terminal_submodule_and_never_uses_stale_inventory():
    from unittest.mock import patch
    from pathlib import Path
    from test_worktree import _fixture, _add_worktree, _add_submodule
    from _testkit import _FakeForge, _git, _git_out
    from domain.context import PullRequest, prstate, store
    from domain.forge import ForgeError
    repo, _, _ = _fixture("task_submodule")
    _add_submodule(repo)
    linked = _add_worktree(repo, "finished")
    _git(linked, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "-q")
    fake = _FakeForge([PullRequest(number=1, state="merged", source_branch="worktree-finished", sha=_git_out(linked, "rev-parse", "HEAD"))])
    with patch.object(prstate, "forge_for_repo", return_value=fake):
        # Seed an old terminal snapshot, then make the live refresh fail.
        assert prstate.refresh_local_pull_requests(repo)
        with patch.object(fake, "prs_for_branch", side_effect=ForgeError("offline")):
            report = pr_lifecycle.sweep_repo(repo)
        assert report["updated"]["local_pull_requests"] is False
        assert report["actions"] == [] and Path(linked).exists()
        report = pr_lifecycle.sweep_repo(repo)
        assert report["updated"]["local_pull_requests"] is True
        assert report["actions"][0]["status"] == "completed"
        assert not Path(linked).exists()
        assert _git_out(repo, "branch", "--list", "worktree-finished") == "worktree-finished"
        assert pr_lifecycle.sweep_repo(repo)["actions"] == []
        assert store.load_segment(repo, "local_pull_requests")["actions"] == []


if __name__ == "__main__":
    run_main(globals())

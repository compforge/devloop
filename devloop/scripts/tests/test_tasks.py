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
        {"repo": "/repo", "errors": ["no usable forge"], "actions": [], "pull_requests": []},
        {"repo": "/repo", "errors": ["offline"], "updated": {"remote_branches": True}},
        {"repo": "/repo", "updated": {"remote_branches": False}},
        {"repo": "/repo", "actions": [{"status": "deferred", "reason": "git_error"}]},
    ]:
        with patch.object(runner.registry, "run", return_value=[row]) as run:
            assert runner.main(["run", "pr-lifecycle-reconcile", "/repo", "--repo-only"]) == 1
            run.assert_called_once_with("pr-lifecycle-reconcile", "/repo", repo_only=True)


def test_real_sweep_preserves_unsaved_submodule_and_never_uses_stale_inventory():
    from unittest.mock import patch
    from pathlib import Path
    from test_worktree import _fixture, _add_worktree, _add_submodule
    from _testkit import _pr_context, _FakeForge, _git, _git_out
    from domain.context import PullRequest, store
    from domain.forge import ForgeError
    repo, _, _ = _fixture("task_submodule")
    _add_submodule(repo)
    linked = _add_worktree(repo, "finished")
    ongoing = _add_worktree(repo, "ongoing")
    _git(linked, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "-q")
    (Path(linked) / "doctor" / "module.txt").write_text("child edit\n")
    fake = _FakeForge([
        PullRequest(number=1, state="merged", source_branch="worktree-finished", sha=_git_out(linked, "rev-parse", "HEAD")),
        PullRequest(number=2, state="open", source_branch="worktree-ongoing", sha=_git_out(ongoing, "rev-parse", "HEAD")),
    ])
    context = _pr_context(repo, fake)
    with patch.object(pr_lifecycle, "pr_context_for_repo", return_value=context), \
         patch.object(fake, "prs_for_branch", side_effect=ForgeError("offline")):
        report = pr_lifecycle.sweep_repo(repo, force=True)
    assert report["errors"] and report["actions"] == [] and Path(linked).exists()
    def query(_repo):
        context = _pr_context(repo, fake)
        context.observer.now = lambda: 4000000000
        return context
    with patch.object(pr_lifecycle, "pr_context_for_repo", side_effect=query):
        report = pr_lifecycle.sweep_repo(repo, force=True)
        assert report["actions"][0]["status"] == "skipped"
        assert (Path(linked) / "doctor" / "module.txt").read_text() == "child edit\n"
        assert Path(ongoing).is_dir()
        assert _git_out(repo, "rev-parse", "refs/heads/worktree-finished")
        assert all(a["status"] == "skipped" for a in pr_lifecycle.sweep_repo(repo, force=True)["actions"])
    assert store.load_segment(repo, "local_pull_requests") is None


def test_sweep_defers_when_checkout_changes_during_forge_lookup():
    # +case=`A terminal PR observation cannot authorize removal of a different checkout identity`
    from unittest.mock import patch
    from pathlib import Path
    from test_worktree import _fixture, _add_worktree
    from _testkit import _pr_context, _FakeForge, _git, _git_out
    from domain.context import PullRequest, prstate, store

    for change in ("branch", "head", "detached"):
        repo, _, _ = _fixture(f"task_identity_{change}")
        target = _add_worktree(repo, "finished")
        head = _git_out(target, "rev-parse", "HEAD")
        fake = _FakeForge([PullRequest(number=1, state="merged", source_branch="worktree-finished", sha=head)])
        lookup = fake.prs_for_branch
        changed = False

        def change_during_lookup(branch, **kwargs):
            nonlocal changed
            if branch == "worktree-finished" and not changed:
                if change == "branch":
                    _git(target, "switch", "-qc", "new-work")
                elif change == "head":
                    _git(target, "commit", "--allow-empty", "-qm", "new work")
                else:
                    _git(target, "switch", "--detach", "-q")
                (Path(target) / "unsaved.txt").write_text("new work\n")
                changed = True
            return lookup(branch, **kwargs)

        fake.prs_for_branch = change_during_lookup
        with patch.object(pr_lifecycle, "pr_context_for_repo", side_effect=lambda _: _pr_context(repo, fake)):
            report = pr_lifecycle.sweep_repo(repo, force=True)
            assert changed and (Path(target) / "unsaved.txt").read_text() == "new work\n", change
            assert all(a["status"] != "completed" for a in report["actions"])
            if change == "branch":
                # A fresh sweep observes the new PR-less branch and retains it.
                assert pr_lifecycle.sweep_repo(repo, force=True)["actions"] == []
                assert (Path(target) / "unsaved.txt").is_file()


def test_idle_cadence_ignores_terminal_pr_on_primary_checkout():
    from unittest.mock import patch
    from test_worktree import _fixture
    from domain.context import store

    repo, _, _ = _fixture("idle_primary")
    discovery = pr_lifecycle.discover()["pr-lifecycle-reconcile"].interval_seconds
    for state, linked, errors, observation, expected in [
        ("merged", False, [], "known", pr_lifecycle.IDLE_INTERVAL),
        ("closed", False, [], "known", pr_lifecycle.IDLE_INTERVAL),
        ("open", False, [], "known", discovery),
        ("merged", True, [], "known", discovery),
        ("merged", False, ["offline"], "unknown", discovery),
        ("merged", False, [], "ambiguous", discovery),
    ]:
        report = {"errors": errors, "has_linked_checkouts": linked,
                  "associations": [{"observation": observation}],
                  "pull_requests": [{"state": state, "checkout": {"primary": True, "path": repo}}]}
        with patch.object(pr_lifecycle, "_sweep_repo", return_value=report), \
             patch.object(pr_lifecycle.time, "time", return_value=1000):
            pr_lifecycle.sweep_repo(repo, force=True)
        assert store.load_segment(repo, "pr_task_attempt")["next_attempt_at"] == 1000 + expected


def test_removal_rechecks_identity_after_successful_association_verification():
    # +case=`A checkout change after Forge verification is rejected at the deletion boundary`
    from unittest.mock import patch
    from pathlib import Path
    from test_worktree import _fixture, _add_worktree
    from _testkit import _pr_context, _FakeForge, _git, _git_out
    from domain import worktree
    from domain.context import PullRequest

    for change in ("branch", "head", "detached"):
        repo, _, _ = _fixture(f"final_identity_{change}")
        target = _add_worktree(repo, "finished")
        fake = _FakeForge([PullRequest(1, state="merged", source_branch="worktree-finished",
                                      sha=_git_out(target, "rev-parse", "HEAD"))])
        context = _pr_context(repo, fake)
        inventory = context.local_branches()
        verify = context.verify
        def change_after_verification(row):
            verified = verify(row)
            assert verified.selected and verified.selected.inactive and not verified.error
            if change == "branch":
                _git(target, "switch", "-qc", "new-work")
            elif change == "head":
                _git(target, "commit", "--allow-empty", "-qm", "new work")
            else:
                _git(target, "switch", "--detach", "-q")
            (Path(target) / "unsaved.txt").write_text("new work")
            return verified
        try:
            with patch.object(context, "verify", side_effect=change_after_verification), \
                 patch.object(worktree.operations, "remove_worktree") as remove:
                actions = context.refresh().maintenance.actions
            remove.assert_not_called()
            assert [(a.status, a.reason) for a in actions] == [("skipped", "checkout_identity_changed")]
            assert (Path(target) / "unsaved.txt").read_text() == "new work"
        finally:
            context.observer.close()


if __name__ == "__main__":
    run_main(globals())

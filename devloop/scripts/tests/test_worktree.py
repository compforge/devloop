#!/usr/bin/env python3
"""Managed worktrees start fresh without rewriting intentional resumes."""

from __future__ import annotations

import shutil
from pathlib import Path
from unittest.mock import patch

from _testkit import _git, _git_out, run_main  # noqa: E402  (bootstrap first)
from domain import worktree  # noqa: E402


def _fixture(name: str) -> tuple[str, str, str]:
    root = Path(f"/tmp/dlut_worktree_{name}")
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    remote = root / "remote.git"
    repo = root / "repo"
    actor = root / "actor"
    remote.mkdir()
    repo.mkdir()

    _git(str(remote), "init", "--bare", "-q")
    _git(str(repo), "init", "-q", "-b", "main")
    _git(str(repo), "config", "user.email", "t@t.t")
    _git(str(repo), "config", "user.name", "t")
    (repo / "base.txt").write_text("base\n")
    _git(str(repo), "add", "base.txt")
    _git(str(repo), "commit", "-qm", "base")
    _git(str(repo), "remote", "add", "origin", str(remote))
    _git(str(repo), "push", "-qu", "-u", "origin", "main")

    _git(str(root), "clone", "-q", "-b", "main", str(remote), str(actor))
    _git(str(actor), "config", "user.email", "t@t.t")
    _git(str(actor), "config", "user.name", "t")
    return str(repo), str(remote), str(actor)


def _add_external_worktree(repo: str, tag: str) -> str:
    path = Path(repo).parent / f"external-{tag}"
    branch = f"external-{tag}"
    _git(repo, "branch", branch)
    _git(repo, "worktree", "add", "-q", str(path), branch)
    return str(path)


def _ensure_report(action="created", **fields):
    return {"schemaVersion": "1.0", "command": "repocli worktree ensure", "outcome": "succeeded",
            "data": {"checkout": str(Path("/repo/.worktrees/topic").resolve()), "branch": "worktree-topic",
                     "headSha": "a" * 40, "confirmed": True, "action": action, "diagnostics": [], "preparation": {"complete": True, "bins": []}, "ready": True, **fields}}


def test_creation_resume_and_reuse_delegate_identity_to_repocli():
    for action, message in (("created", "created worktree from refreshed origin/main"),
                            ("resumed", "reused existing branch"), ("reused", "reused existing worktree")):
        with (patch.object(worktree.git_policy, "local_default_target", return_value="main"),
              patch.object(worktree, "_repocli", return_value=_ensure_report(action)) as run):
            path, actual = worktree.create_or_reuse("/repo", "topic")
        assert path == str(Path("/repo/.worktrees/topic").resolve()) and actual == message
        assert run.call_count == 1
        repo, operation, arguments = run.call_args.args
        assert repo == "/repo" and operation == ("worktree", "ensure")
        assert arguments == [str(Path("/repo/.worktrees/topic").resolve()), "--branch", "worktree-topic",
                             "--base", "main", "--remote", "origin", "--prepare"]
        assert run.call_args.kwargs["timeout"] == 720


def test_failed_and_unknown_ensure_never_prepare_or_fallback():
    for outcome in ("failed", "unknown"):
        report = _ensure_report(); report.update(outcome=outcome, error={"code": "state.worktree_unconfirmed", "message": "inspect checkout"})
        with (patch.object(worktree.git_policy, "local_default_target", return_value="main"),
              patch.object(worktree, "_repocli", return_value=report)):
            path, message = worktree.create_or_reuse("/repo", "topic")
        assert path is None and outcome in message and "inspect checkout" in message


def test_mismatching_or_unconfirmed_reports_never_authorize_preparation():
    for fields in ({"confirmed": False}, {"checkout": "/other"}, {"branch": "different"},
                   {"action": "unknown"}, {"headSha": ""}, {"diagnostics": None}):
        with (patch.object(worktree.git_policy, "local_default_target", return_value="main"),
              patch.object(worktree, "_repocli", return_value=_ensure_report(**fields))):
            path, message = worktree.create_or_reuse("/repo", "topic")
        assert path is None and "unavailable" in message


def test_observation_and_environment_warnings_preserve_confirmed_checkout():
    # +case=Partial preparation preserves the checkout and each failed bin's path and diagnostic.
    report = _ensure_report(ready=False,
        diagnostics=[{"code": "state.observation_unavailable", "message": "metadata unavailable"}],
        preparation={"complete": False, "bins": [
            {"path": "node_modules", "status": "missing", "error": {"message": "registry unavailable"}, "stderr": "connection reset"},
            {"path": ".venv", "status": "missing", "reason": "lockfile missing", "stderr": "inspect uv.lock"},
            {"path": "cache", "status": "unknown", "error": None},
            {"path": "ready-output", "status": "ready"},
        ]})
    report.update(outcome="partial", error={"message": "preparation incomplete"})
    with (patch.object(worktree.git_policy, "local_default_target", return_value="main"),
          patch.object(worktree, "_repocli", return_value=report) as invoke):
        path, message = worktree.create_or_reuse("/repo", "topic")
    assert path == str(Path("/repo/.worktrees/topic").resolve())
    for detail in ("metadata unavailable", "preparation incomplete", "node_modules: registry unavailable",
                   "connection reset", ".venv: lockfile missing", "inspect uv.lock", "cache: unknown"):
        assert detail in message, message
    assert "ready-output" not in message
    assert invoke.call_count == 1


def test_missing_cli_preserves_failure_without_sdk_fallback():
    with (patch.object(worktree.git_policy, "local_default_target", return_value="main"),
          patch.object(worktree, "_repocli", side_effect=FileNotFoundError("repocli"))):
        path, message = worktree.create_or_reuse("/repo", "topic")
    assert path is None and "repocli" in message


def test_repo_context_topology_uses_checkout_locations():
    from repokit.state import checkout_view
    repo, _, _ = _fixture("context_checkout_locations")
    metadata = Path(repo).parent / "metadata"
    _git(repo, "init", "--separate-git-dir", str(metadata))
    linked = _add_external_worktree(repo, "context-linked")
    direct = checkout_view(repo)
    assert next(b.path for b in direct.checkouts if b.branch == "main") == str(Path(repo).resolve())
    observed = checkout_view(linked)
    assert next(b.path for b in observed.checkouts if b.branch == "main") is None
    assert str(metadata) not in [b.path for b in observed.checkouts]


if __name__ == "__main__":
    run_main(globals())

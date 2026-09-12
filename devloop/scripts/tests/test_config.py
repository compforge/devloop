#!/usr/bin/env python3
"""Repository policy follows Git identity while actions remain checkout-local."""
from __future__ import annotations

from _testkit import _git, run_main

import json
import os
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from lib import config
from domain.lifecycle.base import HookResult, dispatch


@contextmanager
def _repository():
    with TemporaryDirectory(prefix="devloop-config-") as temporary:
        root = Path(temporary).resolve()
        repo = root / "repo"
        repo.mkdir()
        _git(repo, "init", "-q", "-b", "main")
        _git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com",
             "commit", "--allow-empty", "-qm", "init")
        with patch.dict(os.environ, {"DEVLOOP_CONFIG_DIR": str(root / "config")}):
            config.save({
                "lifecycle": {
                    "default": {"pre_commit": ["lint", "test"], "post_mr": ["review"]},
                    "repos": {str(repo): {"pre_commit": []}},
                },
                "arch": {"repos": {str(repo): {"enabled": True, "layers": {"/domain/": "domain"}}}},
            })
            yield root, repo


def test_worktrees_inherit_repository_policy():
    for nested in (True, False):
        with _repository() as (root, repo):
            checkout = repo / ".worktrees" / "fix" if nested else root / "external"
            _git(repo, "worktree", "add", "-qb", "fix", str(checkout))
            assert config.lifecycle(checkout) == config.lifecycle(repo)
            assert config.lifecycle(checkout)["pre_commit"] == []
            assert config.lifecycle(checkout)["post_mr"] == ["review"]
            assert config.arch(checkout) == config.arch(repo)


def test_explicit_checkout_policy_overrides_inherited_fields():
    with _repository() as (root, repo):
        checkout = root / "external"
        _git(repo, "worktree", "add", "-qb", "fix", str(checkout))
        local = checkout / ".devloop" / "config.json"
        local.parent.mkdir()
        local.write_text(json.dumps({
            "lifecycle": {"repos": {str(checkout): {"pre_commit": ["test"]}}},
            "arch": {"repos": {str(checkout): {"enabled": False}}},
        }), encoding="utf-8")
        assert config.lifecycle(checkout)["pre_commit"] == ["test"]
        assert config.lifecycle(checkout)["post_mr"] == ["review"]
        assert config.lifecycle(repo)["pre_commit"] == []
        assert config.arch(checkout)["enabled"] is False
        assert config.arch(checkout)["layers"]["/domain/"] == "domain"


def test_dispatch_preserves_review_and_checkout_execution_context():
    with _repository() as (root, repo):
        checkout = root / "external"
        _git(repo, "worktree", "add", "-qb", "fix", str(checkout))
        seen = []

        def review(repo, *, paths):
            seen.append((repo, paths))
            return HookResult("review", ok=True)

        registry = {"review": review}
        assert dispatch("pre_commit", str(checkout), registry=registry).results == []
        result = dispatch("post_mr", str(checkout), paths=["file.go"], registry=registry)
        assert result.proceed and len(result.results) == 1
        assert seen == [(str(checkout), ["file.go"])]


def test_submodule_does_not_inherit_superproject_policy():
    with _repository() as (root, repo):
        source = root / "source"
        _git(root, "clone", "-q", str(repo), str(source))
        _git(repo, "-c", "protocol.file.allow=always", "submodule", "add", "-q", str(source), "child")
        assert config.lifecycle(repo / "child")["pre_commit"] == ["lint", "test"]


def test_worktree_with_separate_git_directory():
    with _repository() as (root, repo):
        _git(repo, "init", "-q", "--separate-git-dir", str(root / "metadata"))
        _git(repo, "config", "core.worktree", str(repo))
        checkout = root / "external"
        _git(repo, "worktree", "add", "-qb", "fix", str(checkout))
        assert config.lifecycle(checkout)["pre_commit"] == []


def test_defaults_and_exact_path_override_without_git_identity():
    with _repository() as (root, _):
        assert config.lifecycle()["pre_commit"] == ["lint", "test"]
        assert config.lifecycle(root / "missing")["pre_commit"] == ["lint", "test"]
        config.save({"lifecycle": {"repos": {str(root): {"pre_commit": []}}}})
        assert config.lifecycle(root)["pre_commit"] == []


if __name__ == "__main__":
    run_main(globals())

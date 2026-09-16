#!/usr/bin/env python3
"""Review launch works without Harness environment and reports missing runners."""
from __future__ import annotations

from _testkit import PLUGIN_ROOT, _git, run_main

import os
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from domain.context import store
from domain.lifecycle.base import dispatch
from domain.lifecycle.review import review
from lib import config


def test_plugin_root_environment_precedence():
    with patch.dict(os.environ, {"PLUGIN_ROOT": "/plugin", "CLAUDE_PLUGIN_ROOT": "/claude"}):
        assert config.plugin_root() == Path("/plugin")
        os.environ.pop("PLUGIN_ROOT")
        assert config.plugin_root() == Path("/claude")


def test_review_launch_without_harness_environment():
    # case:review-launch-without-env The generated command must load the shipped runner.
    with patch.dict(os.environ, {"PLUGIN_ROOT": "", "CLAUDE_PLUGIN_ROOT": ""}):
        result = review(str(PLUGIN_ROOT))
        assert result.ok and result.relay is not None
        assert config.plugin_root() == PLUGIN_ROOT
        command = result.relay.argv
        assert Path(command[1]).is_file(), command
        completed = subprocess.run(
            [*command, "--help"], capture_output=True, text=True, timeout=10,
        )
        assert completed.returncode == 0, completed.stderr
        assert "review the MR diff" in completed.stdout


def test_missing_review_runner_is_visible_and_nonblocking():
    # case:review-missing-runner A packaging failure is advisory, never a successful launch.
    with TemporaryDirectory(prefix="devloop-review-launch-") as temporary:
        repo = Path(temporary)
        _git(repo, "init", "-q", "-b", "feature")
        _git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com",
             "commit", "--allow-empty", "-qm", "init")
        with patch.dict(os.environ, {"PLUGIN_ROOT": str(repo / "missing-plugin")}), \
                patch.object(config, "lifecycle", return_value={"post_mr": ["review"]}):
            result = dispatch("post_mr", str(repo))
        assert result.proceed
        assert result.to_launch == []
        assert len(result.advisory_failures) == 1
        assert "run_review.py" in result.advisory_failures[0].summary
        state = store.load_segment(str(repo), store.branch_segment("feature", "review"))
        assert state["status"] == "error"
        assert "runner not found" in state["message"]
        assert state["count"] == 0


if __name__ == "__main__":
    run_main(globals())

"""CLI results own supported PR queries; unavailable results never become absence."""
from _testkit import run_main

import json
import subprocess
from unittest.mock import patch

from domain.forge import ForgeError
from lib import repocli


def result(data, **overrides):
    return subprocess.CompletedProcess([], 0, json.dumps({
        "schemaVersion": "1.0", "command": "repocli pr list",
        "outcome": "succeeded", "data": data, **overrides,
    }), "")


def pull_request():
    return {
        "key": {"repository": {"forge": {"name": "github"}, "path": "upstream/repo"}, "number": 7},
        "title": "change", "state": "open", "headSha": "abc",
        "sourceBranch": "topic", "targetBranch": "main",
        "sourceRepository": {"forge": {"name": "github"}, "path": "fork/repo"},
        "url": "https://example.invalid/pr/7",
    }


def test_cli_pr_queries_preserve_destination_and_identity():
    with patch.object(repocli.subprocess, "run", return_value=result([pull_request()])) as run, \
         patch.object(repocli, "pull_request_target", return_value="upstream/repo"):
        pr = repocli.list_pull_requests("/repo", branch="topic", state="open")[0]
        assert (pr.number, pr.target_repository, pr.source_repository) == (7, "upstream/repo", "fork/repo")
        args = run.call_args.args[0]
        assert args[:3] == ["repocli", "pr", "list"]
        assert args[args.index("--target-repository") + 1] == "upstream/repo"
        assert "env" not in run.call_args.kwargs and "shell" not in run.call_args.kwargs
        assert run.call_args.kwargs["timeout"] == 12
    with patch.object(repocli.subprocess, "run", return_value=result({"body": "details"}, command="repocli pr show")):
        assert repocli.pull_request_description("/repo", 7, target_repository="upstream/repo") == "details"


def test_cli_failures_are_not_empty_pr_lists():
    malformed = pull_request()
    malformed["title"] = None
    invalid_number = pull_request()
    invalid_number["key"]["number"] = True
    outputs = [
        result(None), result([], outcome="unknown"), result([], outcome="partial"),
        result([], schemaVersion="99"), result([], command="different"), result([{}]),
        result([malformed]), result([invalid_number]),
        subprocess.CompletedProcess([], 1, result([]).stdout, "failed"),
        subprocess.CompletedProcess([], 0, "not JSON", ""),
    ]
    for output in outputs:
        with patch.object(repocli.subprocess, "run", return_value=output), \
             patch.object(repocli, "pull_request_target", return_value=None):
            try:
                repocli.list_pull_requests("/repo", branch="topic", state="open")
            except ForgeError:
                pass
            else:
                raise AssertionError("Unavailable PR results became verified absence")
    with patch.object(repocli.subprocess, "run", return_value=result([])), \
         patch.object(repocli, "pull_request_target", return_value=None):
        assert repocli.list_pull_requests("/repo", branch="topic", state="open") == []


def test_missing_or_timed_out_cli_does_not_fall_back_to_credentials_or_sdk():
    for failure in (FileNotFoundError("repocli"), subprocess.TimeoutExpired("repocli", 12)):
        with patch.object(repocli.subprocess, "run", side_effect=failure), \
             patch.object(repocli, "pull_request_target", return_value=None):
            try:
                repocli.list_pull_requests("/repo", branch="topic", state="open")
            except ForgeError as error:
                assert "unavailable" in str(error)
            else:
                raise AssertionError("Failed CLI query became successful absence")


if __name__ == "__main__":
    run_main(globals())

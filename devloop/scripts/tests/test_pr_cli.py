"""Assert the native CLI boundary, including arguments, credentials and wire results."""
import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import _FakeForge, run_main
from lib import pr_cli
from lib.forge import ForgeResolution
from repokit.forge import PullRequestKey
from domain.forge import ForgeError


def wire(state="open"):
    return {"key": {"repository": {"forge": {"name": "github"}, "path": "o/r"}, "number": 7},
            "title": "title", "state": state, "sourceBranch": "feature", "targetBranch": "release",
            "url": "https://github.com/o/r/pull/7", "headSha": "abc",
            "sourceRepository": {"forge": {"name": "github"}, "path": "o/r"}}


def test_commands_forward_identity_body_and_credentials_without_a_shell():
    resolution = ForgeResolution("github", "github.com", "github.com", "o/r", "fixture-secret")
    forge = _FakeForge([])
    calls = []
    with TemporaryDirectory(prefix="native pr ") as repo:
        commands = pr_cli.PullRequestCommands(repo, forge)

        def invoke(argv, **kwargs):
            assert argv[1] == "pr" and kwargs["cwd"] == repo and kwargs["timeout"] == 135
            assert "fixture-secret" not in " ".join(argv) and kwargs["env"]["GH_TOKEN"] == "fixture-secret"
            assert argv[argv.index("--target-repository") + 1] == forge.repository().path
            calls.append(argv[2:4])
            if argv[2] == "update":
                assert argv[3] == "7" and argv[argv.index("--title") + 1] == "updated"
                assert Path(argv[argv.index("--body-file") + 1]).read_text() == "body\nwith `literal` text"
            result = {"pull_request": wire("closed" if argv[2] == "close" else "open"), "created": False, "maintenance": {"errors": []}}
            return subprocess.CompletedProcess(argv, 0, json.dumps(result), "")

        with patch.object(pr_cli, "resolve_forge", return_value=resolution), patch.object(pr_cli.subprocess, "run", side_effect=invoke):
            key = PullRequestKey(forge.repository(), 7)
            assert commands.update(key, title="updated", body="body\nwith `literal` text").number == 7
            assert commands.close(key).state == "closed"
    assert calls == [["update", "7"], ["close", "7"]]


def test_cli_failure_and_invalid_json_are_not_reported_as_success():
    resolution = ForgeResolution("github", "github.com", "github.com", "o/r", "fixture-secret")
    for code, stdout in ((1, "{}"), (0, "not-json")):
        with patch.object(pr_cli, "resolve_forge", return_value=resolution), patch.object(pr_cli.subprocess, "run", return_value=subprocess.CompletedProcess([], code, stdout, "failed")):
            try:
                pr_cli.invoke("/repo", ["show", "7"], target="o/r")
                raise AssertionError("invalid response accepted")
            except ForgeError:
                pass


def test_create_preserves_existing_base_and_consumes_native_result():
    forge = _FakeForge([])
    commands = pr_cli.PullRequestCommands("/repo", forge)
    current = wire()
    current["sourceRepository"]["path"] = forge.repository().path
    calls = []

    def invoke(repo, args, *, target):
        assert repo == "/repo" and target == forge.repository().path
        calls.append(args)
        if args[0] == "list":
            return [current]
        assert args[0] == "create" and args[args.index("--base") + 1] == "release"
        return {"pull_request": current, "created": False, "maintenance": {"errors": []}}

    with patch.object(pr_cli, "invoke", side_effect=invoke):
        result = commands.ensure_pull_request(source_branch="feature", title="title")
    assert not result.created and result.pull_request.number == 7
    assert len(calls) == 2


if __name__ == "__main__":
    run_main(globals())

#!/usr/bin/env python3
"""PR comment detail preserves the evidence needed to adjudicate a review."""
from __future__ import annotations

import io
import os
import subprocess
import tempfile
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from _testkit import PLUGIN_ROOT, SCRIPTS, _load_script, run_main
from domain.forge import Comment, CommentResolution, ForgeError


def test_comment_reads_full_thread_beyond_summary_limits():
    prcli = _load_script("pr")
    body = "A long finding " * 40 + "\n```python\nraise ValueError('example')\n```\n"
    reply_body = "Detailed counter-evidence " * 30 + "\n  preserve indentation\n"
    for provider, label in (("github", "PR #5"), ("gitlab", "MR !5")):
        for resolution in CommentResolution:
            comments = [Comment(id=str(n), body="unrelated") for n in range(25)]
            comments.append(Comment(
                id="target", author="reviewer", body=body, path="a.py", line=42,
                resolution=resolution, replies=[
                    Comment(id="reply1", author="author", body=reply_body),
                    Comment(id="reply2", author="reviewer", body="Last reply."),
                ],
            ))
            calls = []

            def read_comments(number):
                calls.append(number)
                return comments

            # Only the comments capability is available: no metadata query or mutation needed.
            forge = SimpleNamespace(provider=provider, comments=read_comments)
            output = io.StringIO()
            with patch.object(prcli, "_forge_or_exit", return_value=forge), redirect_stdout(output):
                assert prcli.main(["comment", "5", "target", "--repo", "/some/repo"]) == 0
            rendered = output.getvalue()
            assert calls == [5]
            assert f"{label} comment target by reviewer" in rendered
            assert f"Thread resolution (Forge): {resolution.value}" in rendered
            assert "Location: a.py:42" in rendered
            assert body in rendered and reply_body in rendered
            assert "Replies (2):" in rendered
            assert "Reply reply1 by author" in rendered
            assert "Reply reply2 by reviewer\nLast reply." in rendered
            assert "unrelated" not in rendered


def test_comment_reads_plain_note_without_inferring_resolution():
    prcli = _load_script("pr")
    forge = SimpleNamespace(provider="github", comments=lambda number: [
        Comment(id="plain", author="author", body="A note."),
    ])
    output = io.StringIO()
    with patch.object(prcli, "_forge_or_exit", return_value=forge), redirect_stdout(output):
        assert prcli.main(["comment", "https://github.com/example/project/pull/5", "plain"]) == 0
    rendered = output.getvalue()
    assert "Thread resolution (Forge): unsupported" in rendered
    assert "Replies (0):" in rendered
    assert "Location:" not in rendered


def test_comment_missing_id_and_provider_error_are_failures():
    prcli = _load_script("pr")

    def failed_query(number):
        raise ForgeError("comment query failed")

    for read_comments, expected in (
        (lambda number: [], "no comment missing on MR !5"),
        (failed_query, "comment query failed"),
    ):
        forge = SimpleNamespace(provider="gitlab", comments=read_comments)
        output, error = io.StringIO(), io.StringIO()
        with patch.object(prcli, "_forge_or_exit", return_value=forge), \
                redirect_stdout(output), redirect_stderr(error):
            assert prcli.main(["comment", "5", "missing"]) == 1
        assert expected in error.getvalue()
        assert not output.getvalue()


def test_pr_cli_bootstraps_private_modules_from_foreign_cwd():
    # Exercise the actual shell/Python entrypoint rather than the testkit import bootstrap.
    with tempfile.TemporaryDirectory() as directory:
        cwd = Path(directory)
        for name in ("lib", "domain"):
            package = cwd / name
            package.mkdir()
            (package / "__init__.py").write_text("raise AssertionError('foreign package imported')\n")
        for pythonpath in (None, str(PLUGIN_ROOT)):
            env = dict(os.environ)
            env.pop("PYTHONPATH", None)
            if pythonpath is not None:
                env["PYTHONPATH"] = pythonpath
            result = subprocess.run(
                [str(SCRIPTS / "python"), str(SCRIPTS / "pr.py"), "comment", "--help"],
                cwd=cwd, env=env, capture_output=True, text=True, check=False,
            )
            assert result.returncode == 0, result.stderr
            assert "comment-id" in result.stdout and "--repo" in result.stdout


if __name__ == "__main__":
    run_main(globals())

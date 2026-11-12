#!/usr/bin/env python3
"""forge port：origin 解析/provider 识别、PR 映射、window 组合、PR 复用/创建、default branch。

Standalone: `python3 devloop/tests/test_forge.py`（也 pytest-collectable）；共享设施见 _testkit.py。
"""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import replace

from _testkit import _FakeForge, _git, _load_script, run_main  # noqa: E402  (bootstrap first)
from domain.context import Cadence, PullRequest  # noqa: E402
from repokit.forge import detect_provider
from repokit.git.remote import remote

def parse_origin(repo):
    observed = remote(repo)
    return (observed.host, observed.path) if observed else None  # noqa: E402
from domain.forge import pr_label  # noqa: E402


def test_pr_label():
    assert pr_label("github", 3) == "PR #3"
    assert pr_label("gitlab", 3) == "MR !3"
    assert pr_label("", 3) == "PR #3"   # unknown → PR/#

def test_parse_origin_and_detect_provider():
    R = "/tmp/dlut_repo"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    subprocess.run(["git", "init", "-q"], cwd=R, check=True)
    subprocess.run(["git", "remote", "add", "origin", "git@github.com:owner/repo.git"],
                   cwd=R, check=True)
    host, path = parse_origin(R)
    assert host == "github.com" and path == "owner/repo"
    subprocess.run(["git", "remote", "set-url", "origin", "https://gitlab.com/g/s/proj.git"], cwd=R, check=True)
    host, path = parse_origin(R)
    assert host == "gitlab.com" and path == "g/s/proj"
    # provider inference from host, with explicit config override winning
    assert detect_provider("github.com", None) == "github"
    assert detect_provider("gitlab.example.com", None) == "gitlab"
    assert detect_provider("git.acme.com", None) == "gitlab"            # default
    assert detect_provider("git.acme.com", "github") == "github"        # GHE on custom host


def test_review_findings_exposes_thread_identity_for_repocli():
    """+case=Finding comment IDs stay distinct from platform thread IDs for CLI handoff."""
    import io
    from contextlib import redirect_stdout
    from types import SimpleNamespace
    from unittest.mock import patch
    from domain.forge import Comment

    reviewcli = _load_script("review")
    comment = Comment(id="20", resolve_ref="PRRT_thread", reply_ref="20", body="finding ccr:fp=identity")
    forge = SimpleNamespace(comments=lambda number: [comment])
    output = io.StringIO()
    with patch.object(reviewcli, "_forge_or_exit", return_value=forge), redirect_stdout(output):
        assert reviewcli.main(["findings", "5"]) == 0
    assert "20  [PENDING]" in output.getvalue()
    assert "thread=PRRT_thread" in output.getvalue()


def test_review_cli_separates_verdict_from_resolution():
    """The review CLI owns typed Verdicts; recording one never resolves its thread."""
    from domain.forge import Comment, CommentResolution
    reviewcli = _load_script("review")

    class _F(_FakeForge):
        def __init__(self, prs):
            super().__init__(prs)
            self.replied = []
            self.resolved = []
        def comments(self, number):
            return [
                Comment(
                    id="20",
                    reply_ref="20",
                    path="a.py",
                    line=5,
                    body="漏判空 ccr:fp=fp1",
                    replies=[Comment(id="21", body="ccr:label=wrong — 走不到")],
                ),
                Comment(
                    id="30",
                    reply_ref="30",
                    resolve_ref="30",
                    resolution=CommentResolution.UNRESOLVED,
                    path="b.py",
                    body="缺测试 ccr:fp=fp2",
                ),
            ]
        def reply(self, number, target, body):
            self.replied.append((number, target.id, body))
        def resolve_comment(self, number, target):
            self.resolved.append((number, target.resolve_ref))

    fake = _F([PullRequest(number=5, state="open", source_branch="feat/x")])

    class _R:
        git_root = "/x"

    orig_forge = reviewcli.forge_client
    orig_resolve = reviewcli.cli.resolve_repo_or_exit
    try:
        reviewcli.forge_client = lambda repo: fake
        reviewcli.cli.resolve_repo_or_exit = lambda ns, prog: (_R(), "test")
        assert reviewcli.main(["findings", "5"]) == 0
        assert reviewcli.main(["findings", "5", "--pending"]) == 0
        assert reviewcli.main([
            "label", "5", "30", "minor", "--reason", "  ",
        ]) == 1
        assert fake.replied == []
        assert reviewcli.main([
            "label", "5", "30", "minor", "--reason", "真问题，待修复",
        ]) == 0
        assert fake.replied == [(5, "30", "ccr:label=minor — 真问题，待修复")]
        assert fake.resolved == []

        # The fake Forge does not mutate its comment snapshot after a reply, so expose the
        # recorded Verdict when testing the later, independent resolution action.
        original_comments = fake.comments
        fake.comments = lambda number: [
            replace(finding, replies=[Comment(body="ccr:label=minor — 真问题")])
            if finding.id == "30" else finding
            for finding in original_comments(number)
        ]
        assert reviewcli.main(["resolve", "5", "30"]) == 1
        assert fake.resolved == []
        assert reviewcli.main(["resolve", "5", "30", "--fixed"]) == 0
        assert fake.resolved == [(5, "30")]
        assert reviewcli.main([
            "missed", "5", "--path", "c.py", "--line", "9", "--reason", "遗漏边界",
        ]) == 0
        assert fake.diff_posted[-1][:3] == (5, "c.py", 9)
        assert fake.diff_posted[-1][3] == "ccr:missed — 遗漏边界"
        assert reviewcli.main([
            "label", "5", "999", "wrong", "--reason", "not found",
        ]) == 1
    finally:
        reviewcli.forge_client = orig_forge
        reviewcli.cli.resolve_repo_or_exit = orig_resolve


def test_checkout_pr_without_forge():
    """Repositories without a Forge have no remote PR context."""
    from domain.context import prstate
    R = "/tmp/dlut_refresh"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q")
    assert prstate.checkout_pr(R) == ("", None)


def test_pullrequest_and_cadence():
    pr = PullRequest.from_dict({"number": 7, "state": "merged", "source_branch": "f", "target_branch": "m"})
    assert pr.inactive and PullRequest.from_dict({"number": 8, "state": "open"}).inactive is False
    # in-flight(open)与 inactive(merged/closed)互斥——循环"轮次之间"的第四态
    assert PullRequest.from_dict({"number": 9, "state": "open"}).is_open
    assert not PullRequest.from_dict({"number": 10, "state": "merged"}).is_open and not pr.is_open
    c = Cadence()
    assert c.should_emit("x", now=100, ttl=1800)
    c.mark("x", now=100)
    assert not c.should_emit("x", now=200, ttl=1800)        # same → skip
    assert c.should_emit("y", now=200, ttl=1800)            # changed → emit
    assert c.should_emit("x", now=100 + 1800, ttl=1800)     # TTL → emit
    c.clear()
    assert c.should_emit("x", now=200, ttl=1800)            # PostCompact clear → emit


def test_merge_reminders_are_devloop_policy():
    from domain.forge import MergeReadiness, blocks_merge
    assert {state for state in MergeReadiness if blocks_merge(state)} == {
        MergeReadiness.CONFLICT, MergeReadiness.DISCUSSIONS_UNRESOLVED, MergeReadiness.CI_BLOCKED,
    }


def test_repo_context_uses_repokit_facts_without_duplicate_repository_storage():
    """+case=Task target and historical creation base remain distinct; only AGENTS knowledge is cached."""
    from tempfile import TemporaryDirectory
    from unittest.mock import patch
    from _repo_fixture import make_repo
    from domain.context import repo as context, prstate, store
    from repokit.state import CheckoutView, BranchCreation, RemoteBranches

    with TemporaryDirectory() as directory:
        root = str(make_repo(directory))
        facts = CheckoutView(root, "topic", "a" * 40, "release", (),
            BranchCreation("topic", "old-base", "b" * 40, "origin", "/git", 1))
        with patch.object(context, "checkout_view", return_value=facts), \
             patch.object(context, "remote_branches", return_value=RemoteBranches((("release", "c" * 40),), 5)), \
             patch.object(prstate, "checkout_pr", return_value=("", None)):
            refreshed = context.RepoContext.refresh_all(root)
            assert refreshed.repo.default_branch == "release"
            assert refreshed.branch.local.name == "topic"
            assert refreshed.branch.local.creation_base == "old-base"
            assert refreshed.branch.base_branch() == "release"
            assert refreshed.branch.remote_tip("release").commit == "c" * 40
            assert context.RepoContext.load(root).branch.local.name == "topic"
        assert store.load_segment(root, "agents") is not None
        for name in ("meta", store.branch_segment("topic", "branch"), "remote_branches"):
            assert not store.segment_file(root, name).exists()


if __name__ == "__main__":
    run_main(globals())

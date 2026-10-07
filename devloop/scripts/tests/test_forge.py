#!/usr/bin/env python3
"""forge port：origin 解析/provider 识别、PR 映射、window 组合、PR 复用/创建、default branch。

Standalone: `python3 devloop/tests/test_forge.py`（也 pytest-collectable）；共享设施见 _testkit.py。
"""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import sys
from contextlib import redirect_stdout
from dataclasses import replace

from _testkit import _FakeForge, _git, _load_script, run_main  # noqa: E402  (bootstrap first)
from domain.context import Cadence, PullRequest  # noqa: E402
from lib.forge import detect_provider, parse_origin  # noqa: E402
from domain.forge import build_window, parse_pr_number, pr_label  # noqa: E402
from repocli.forge.github import GitHubForge  # noqa: E402
from repocli.forge.gitlab import GitLabForge  # noqa: E402
from repocli.forge._rest import RestClient  # noqa: E402


def test_build_window():
    """Provider-agnostic window policy over the port's recent+get: newest `cap`, with the
    anchor PR always present (fetched via get if it fell off the recent list)."""
    prs = [PullRequest(number=n, state="open", source_branch=f"b{n}") for n in range(1, 21)]
    f = _FakeForge(prs)
    # anchor near latest → just the newest cap
    nums = [p.number for p in build_window(f, 20, cap=5)]
    assert nums == [20, 19, 18, 17, 16]
    # anchor older than the newest cap → newest cap-1 + the anchor (anchor always present)
    nums = [p.number for p in build_window(f, 3, cap=5)]
    assert 3 in nums and nums[:4] == [20, 19, 18, 17] and len(nums) == 5
    # no anchor → newest cap
    assert [p.number for p in build_window(f, None, cap=5)] == [20, 19, 18, 17, 16]
    # anchor that doesn't exist (404 on get) → silently dropped, still returns newest cap
    nums = [p.number for p in build_window(f, 999, cap=5)]
    assert nums == [20, 19, 18, 17, 16]




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



def test_pr_cli_dispatch():
    """The `pr` CLI routes show/list/update/close to the forge facade (config-driven,
    provider-neutral). There is deliberately no `create` verb — opening an MR is gcampr's
    gated transaction, so `pr create` is rejected like any unknown verb."""
    prcli = _load_script("pr")
    fake = _FakeForge([PullRequest(number=5, state="open", source_branch="feat/x",
                                   target_branch="main", title="T", web_url="u/5")])

    class _R:
        git_root = "/x"

    orig_forge = prcli.forge_for_repo
    orig_resolve = prcli.cli.resolve_repo_or_exit
    try:
        prcli.forge_for_repo = lambda repo: fake
        prcli.cli.resolve_repo_or_exit = lambda ns, prog: (_R(), "test")
        assert prcli.main(["show", "5"]) == 0
        assert prcli.main(["list"]) == 0
        assert prcli.main(["list", "--branch", "feat/x"]) == 0
        assert prcli.main(["update", "5", "--title", "New"]) == 0
        assert prcli.main(["close", "5"]) == 0
        assert fake.get(5).state == "closed"   # close flipped state via the facade
        assert prcli.main(["update", "5"]) == 1   # nothing to update → error
        try:                                       # no create verb → argparse "invalid choice" → exit(2)
            prcli.main(["create", "--message", "m"])
            raised = False
        except SystemExit:
            raised = True
        assert raised
    finally:
        prcli.forge_for_repo = orig_forge
        prcli.cli.resolve_repo_or_exit = orig_resolve


def test_pr_show_exposes_replyable_comment_ids():
    """`pr show` exposes the top-level comment id consumed by `pr reply`."""
    from domain.forge import Comment
    prcli = _load_script("pr")

    class _F(_FakeForge):
        def comments(self, number):
            return [Comment(id="30", author="reviewer", body="please fix")]

    fake = _F([PullRequest(number=5, state="open", source_branch="feat/x")])

    class _R:
        git_root = "/x"

    orig_forge = prcli.forge_for_repo
    orig_resolve = prcli.cli.resolve_repo_or_exit
    try:
        prcli.forge_for_repo = lambda repo: fake
        prcli.cli.resolve_repo_or_exit = lambda ns, prog: (_R(), "test")
        output = io.StringIO()
        with redirect_stdout(output):
            assert prcli.main(["show", "5"]) == 0
        assert "- 30  reviewer: please fix" in output.getvalue()
    finally:
        prcli.forge_for_repo = orig_forge
        prcli.cli.resolve_repo_or_exit = orig_resolve


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

    orig_forge = reviewcli.forge_for_repo
    orig_resolve = reviewcli.cli.resolve_repo_or_exit
    try:
        reviewcli.forge_for_repo = lambda repo: fake
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
        reviewcli.forge_for_repo = orig_forge
        reviewcli.cli.resolve_repo_or_exit = orig_resolve


def test_pr_reply_has_no_review_side_effects():
    """Generic PR replies stay generic even when their body resembles a review label."""
    from domain.forge import Comment
    prcli = _load_script("pr")

    class _F(_FakeForge):
        def __init__(self, prs):
            super().__init__(prs)
            self.replied = []

        def comments(self, number):
            return [Comment(id="30", reply_ref="30", body="discussion")]

        def reply(self, number, target, body):
            self.replied.append((number, target.id, body))

    fake = _F([PullRequest(number=5, state="open")])

    class _R:
        git_root = "/x"

    orig_forge, orig_resolve = prcli.forge_for_repo, prcli.cli.resolve_repo_or_exit
    try:
        prcli.forge_for_repo = lambda repo: fake
        prcli.cli.resolve_repo_or_exit = lambda ns, prog: (_R(), "test")
        assert prcli.main(["reply", "5", "30", "ccr:label=minor — just text"]) == 0
        assert fake.replied == [(5, "30", "ccr:label=minor — just text")]
        assert prcli.main(["reply", "5", "999", "x"]) == 1
    finally:
        prcli.forge_for_repo = orig_forge
        prcli.cli.resolve_repo_or_exit = orig_resolve


def test_release_cli_dispatch():
    """`release` CLI over the facade: create validates semver + strict increment, defaults the
    target to the repo trunk, requires semantic notes, and reads the latest release."""
    from lib import git_state
    rel = _load_script("release")
    fake = _FakeForge([])

    class _R:
        git_root = "/x"

    orig_forge, orig_resolve = rel.forge_for_repo, rel.cli.resolve_repo_or_exit
    orig_trunk = git_state.local_default_target
    try:
        rel.forge_for_repo = lambda repo: fake
        rel.cli.resolve_repo_or_exit = lambda ns, prog: (_R(), "test")
        git_state.local_default_target = lambda repo: "main"

        # Semantic notes are caller-owned: omission must not silently publish a raw PR list.
        assert rel.main(["create", "v1.8.0"]) == 1
        assert getattr(fake, "released", None) is None
        # Caller-supplied semantic notes are accepted; target defaults to trunk.
        notes = "## New Features\n\n- Add one user-visible capability."
        assert rel.main(["create", "v1.8.0", "--notes", notes]) == 0
        assert fake.released.tag == "v1.8.0" and fake.released.target == "main"
        assert fake.released_notes == notes
        # non-semver rejected before any call
        fake.released = None
        assert rel.main(["create", "1.8"]) == 1 and fake.released is None
        # not-greater-than-last rejected (last is now v1.8.0)
        assert rel.main(["create", "v1.8.0"]) == 1 and fake.released is None
        assert rel.main(["create", "v1.7.0"]) == 1 and fake.released is None
        # higher version accepted; explicit --target and --notes honored (no draft)
        assert rel.main(["create", "v1.9.0", "--target", "abc123", "--notes", "manual"]) == 0
        assert fake.released.tag == "v1.9.0" and fake.released.target == "abc123"
        assert fake.released_notes == "manual"
        # latest reads the newest
        assert rel.main(["latest"]) == 0
    finally:
        rel.forge_for_repo, rel.cli.resolve_repo_or_exit = orig_forge, orig_resolve
        git_state.local_default_target = orig_trunk

def test_reuse_or_create_pr_over_narrowed_port():
    """reuse_or_create_pr: reuse the branch's OPEN pr if present (via prs_for_branch),
    else create. Over the narrowed port + a fake forge — no HTTP; label is repo-level."""
    sgo = _load_script("commit_flow")
    orig = sgo.forge_for_repo
    try:
        # reuse: an open PR exists for the branch
        f = _FakeForge([PullRequest(number=3, state="open", source_branch="feat/x", web_url="u/3")])
        sgo.forge_for_repo = lambda repo: f
        plan = []
        pr = sgo.reuse_or_create_pr("/repo", "feat/x", "main", "t", "", plan)
        assert pr.number == 3 and f.created is None
        assert any("reused open PR #3" in line for line in plan)
        # create: only a finished PR for the branch → open a new one, body = description
        f2 = _FakeForge([PullRequest(number=3, state="merged", source_branch="feat/x")])
        sgo.forge_for_repo = lambda repo: f2
        plan = []
        pr = sgo.reuse_or_create_pr("/repo", "feat/x", "main", "t", "why & what", plan)
        assert f2.created is not None and pr.number == 4
        assert any("created PR #4" in line for line in plan)
        assert f2.description(4) == "why & what"
    finally:
        sgo.forge_for_repo = orig

def test_refresh_pr_failopen():
    """prstate.refresh_pr (gcampr's authoritative live-PR preflight, via gate.evaluate
    live_refresh) is best-effort: a repo with no forge remote/token returns False rather than
    raising — and crucially it now PERSISTS its poll (the old refresh_pr_state discarded it)."""
    from domain.context import prstate
    R = "/tmp/dlut_refresh"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q")
    assert prstate.refresh_pr(R) is False   # no forge → no-op, no exception, nothing written

def test_pick_branch_pr():
    """Relocated to domain.context.prstate (so the gate and the monitor share one picker). Open PR
    wins; else the most-recent finished PR whose source sha is an ancestor of HEAD — the
    SHA-ancestry check is git_state.is_ancestor (patched here)."""
    from lib import git_state
    from domain.context import prstate
    P = lambda **kw: PullRequest(**kw)  # noqa: E731
    orig = git_state.is_ancestor
    try:
        git_state.is_ancestor = lambda repo, anc, desc: True
        assert prstate.pick_branch_pr([P(number=5, state="open", sha="a"),
                                       P(number=4, state="merged", sha="b")], "r", "h").number == 5
        git_state.is_ancestor = lambda repo, anc, desc: anc == "b"
        assert prstate.pick_branch_pr([P(number=4, state="merged", sha="b"),
                                       P(number=3, state="closed", sha="c")], "r", "h").number == 4
        git_state.is_ancestor = lambda repo, anc, desc: False
        assert prstate.pick_branch_pr([P(number=4, state="merged", sha="dead")], "r", "h") is None
    finally:
        git_state.is_ancestor = orig

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
















def test_repo_meta_default_branch_roundtrip():
    """default_branch + default_branch_at 经 asdict/from_dict 往返不丢(meta 段持久化路径)。"""
    from dataclasses import asdict

    from domain.context.repo import RepoMeta
    m = RepoMeta(repo_dir="/r", default_branch="release", default_branch_at=123.0)
    m2 = RepoMeta.from_dict(asdict(m))
    assert m2.default_branch == "release" and m2.default_branch_at == 123.0

def test_resolve_default_branch_ttl():
    """TTL 门控:新鲜缓存零网络(不碰 forge);过期才取 forge 的权威值并打新时间戳。"""
    from domain.context import base as B
    from domain.context import repo as R

    calls = {"forge": 0}

    def _no_forge(d):
        calls["forge"] += 1
        return None

    orig = R.forge_for_repo
    R.forge_for_repo = _no_forge
    try:
        db, at = R._resolve_default_branch("/r", "main", B.now())   # 新鲜
        assert db == "main" and calls["forge"] == 0                 # 命中缓存、未拉

        class _F:
            def default_branch(self): return "release"

        R.forge_for_repo = lambda d: _F()
        db2, at2 = R._resolve_default_branch("/r", "main", 0.0)     # 过期(at=0)
        assert db2 == "release" and at2 > 0                         # forge 权威值 + 新时间戳
    finally:
        R.forge_for_repo = orig



def test_merge_reminders_are_devloop_policy():
    from domain.forge import MergeReadiness, blocks_merge
    assert {state for state in MergeReadiness if blocks_merge(state)} == {
        MergeReadiness.CONFLICT, MergeReadiness.DISCUSSIONS_UNRESOLVED, MergeReadiness.CI_BLOCKED,
    }


if __name__ == "__main__":
    run_main(globals())

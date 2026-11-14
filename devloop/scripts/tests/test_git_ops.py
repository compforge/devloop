#!/usr/bin/env python3
"""commit_flow 编排：staging 过滤、分支决策/切分、CLI 入参（message/repo）、提交与推送边界。

Standalone: `python3 devloop/scripts/tests/test_git_ops.py`（也 pytest-collectable）；共享设施见 _testkit.py。
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from _testkit import _git, _git_out, _load_script, run_main  # noqa: E402  (bootstrap first)
from domain.context import PullRequest  # noqa: E402


def test_workflow_entrypoints_are_executable():
    """Workflow wrappers may be invoked directly even though skills normally spell out `bash`."""
    scripts = Path(__file__).resolve().parent.parent
    missing = [path.name for path in scripts.glob("smart_*.sh") if not os.access(path, os.X_OK)]
    if not os.access(scripts / "branch.py", os.X_OK):
        missing.append("branch.py")
    assert missing == []


def test_sensitive_filter():
    from domain.commit import is_sensitive
    assert is_sensitive(".env") and is_sensitive("sub/.env.local")
    assert is_sensitive("a/.idea/x") and is_sensitive("pkg/__pycache__/m.pyc")
    assert not is_sensitive("src/main.py") and not is_sensitive("README.md")


def test_decide_branch_is_intent_driven():
    """--branch 一律基于 base(默认 origin/<target>),与当前停在哪条分支无关——避免新 MR
    夹带上一条未合 feature 分支的提交。"""
    decide = _load_script("commit_flow").decide_branch
    B = "origin/release"
    # 新 --branch:即便当前停在另一条未合 feature 分支,也切自 base 而非当前 HEAD
    assert decide("chat-fix", "bump-x", protected=False, stale=False, base=B) == ("cut", B)
    # 显式 --base → 故意栈式,切自该 base
    assert decide("release", "feat2", protected=True, stale=False, base="feat1") == ("cut", "feat1")
    # 无 --branch + 健康分支 → 续写当前(往开着的 MR 加提交)
    assert decide("feat1", None, protected=False, stale=False, base=B) == ("continue", None)
    # 无 --branch + protected → 报错,要 --branch
    act, why = decide("release", None, protected=True, stale=False, base=B)
    assert act == "error" and "protected" in why
    # 无 --branch + MR 已 merged/closed(stale) → 报错
    act, why = decide("old", None, protected=False, stale=True, base=B)
    assert act == "error" and "merged" in why
    # --branch == 当前分支(已在该分支)→ 续写,不重切
    assert decide("feat1", "feat1", protected=False, stale=False, base=B) == ("continue", None)

def test_refusal_detail_quotes_pr_evidence():
    """A stale-branch refusal embeds the live-polled PR evidence (number/state/sha/url) so the
    caller trusts the verdict instead of re-querying the forge; protected branches (no PR) and an
    open PR (not inactive) fall back to the plain reason."""
    sgo = _load_script("commit_flow")
    from domain.context import gate
    from domain.forge import PullRequest

    def gv(pr):
        return gate.GateView(git_root="/x", branch="feat/a", head_sha="h", target="main",
                             provider="gitlab", active_pr=pr)

    merged = PullRequest(number=129, state="merged", source_branch="feat/a",
                         sha="541268f2481b", web_url="https://code.byted.org/x/merge_requests/129",
                         updated_at="2026-06-18T10:05:05+08:00")
    detail = sgo.refusal_detail(gv(merged), "current branch's MR is merged/closed")
    assert "MR !129 merged" in detail and "541268f24" in detail
    assert "merge_requests/129" in detail
    # no PR (protected) and open PR (not inactive) → plain fallback, no fabricated evidence
    assert sgo.refusal_detail(gv(None), "protected branch") == "protected branch"
    open_pr = PullRequest(number=7, state="open", source_branch="feat/a")
    assert sgo.refusal_detail(gv(open_pr), "fallback") == "fallback"

def test_branch_create_respects_checkout_owner():
    """The script-owned checkout path enforces the same owner boundary as raw git guards."""
    from domain import branch as branch_domain
    from domain.context import session

    R = "/tmp/dlut_branch_owner"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q", "-b", "main"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    Path(f"{R}/f").write_text("x"); _git(R, "add", "f"); _git(R, "commit", "-qm", "init")
    assert session.acquire(R, "owner", "main", harness="codex", pid=os.getpid())
    try:
        branch_domain.create(
            R,
            "feat/guest",
            "main",
            identity=session.SessionIdentity("codex", "guest"),
        )
        assert False, "foreign owner must block branch creation"
    except branch_domain.BranchError as exc:
        assert "owned by another codex session" in str(exc) and "managed worktree" in str(exc)
    assert _git_out(R, "branch", "--show-current") == "main"


def test_branch_cli_routes_create_to_the_transaction():
    """The documented branch command resolves the repo and emits a verifiable PLAN."""
    import contextlib
    import io

    branch_cli = _load_script("branch")
    repo = "/tmp/dlut_branch_cli"
    shutil.rmtree(repo, ignore_errors=True); os.makedirs(repo)
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@t.t"); _git(repo, "config", "user.name", "t")
    Path(repo, "f").write_text("x"); _git(repo, "add", "f"); _git(repo, "commit", "-qm", "init")

    output = io.StringIO()
    from unittest.mock import patch
    from domain.branch import CreateResult
    with patch("domain.branch.create", return_value=CreateResult("feat/cli", "main", True, False)) as create, contextlib.redirect_stdout(output):
        rc = branch_cli.main(["create", "feat/cli", "--repo", repo, "--base", "main"])
    assert rc == 0 and Path(create.call_args.args[0]).resolve() == Path(repo).resolve()
    assert create.call_args.args[1:3] == ("feat/cli", "main")
    assert "action=branch-create" in output.getvalue() and "off main" in output.getvalue()


def test_prepare_branch_reads_gate_pr_state():
    """prepare_branch decides on gate truth (GateView), not the cached ctx. decide_branch's
    unit test bypasses this call, so an end-to-end run guards the wiring (and that gcampr reads
    the LIVE-branch / SHA-validated PR state, not ctx.branch_pr_inactive)."""
    sgo = _load_script("commit_flow")
    from domain.context import RepoContext, gate, prstate
    R = "/tmp/dlut_prep"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    _git(R, "checkout", "-q", "-b", "feat/a")
    Path(f"{R}/f").write_text("x"); _git(R, "add", "f"); _git(R, "commit", "-qm", "i")
    RepoContext.refresh_all(R)
    intent = sgo.GitIntent(mode="push", message="m", requested_branch=None,
                           target="main", base="origin/main", explicit_base=False,
                           files=[], repo=R, source="test", invoke_cwd=R)
    # healthy branch, no PR segment → gate finds no PR → continue on the current branch
    res = sgo.prepare_branch(intent, gate.evaluate(R), [])
    assert res.branch == "feat/a" and res.cut is False

    # in-flight: an OPEN PR for feat/a in the monitor-owned pr segment → gate picks it (open
    # wins, no SHA check) → continue + a self-narrating line built with the repo-level provider
    from unittest.mock import patch
    from _testkit import _pr_context, _FakeForge
    context = _pr_context(R, _FakeForge([PullRequest(number=7, state="open", source_branch="feat/a")]))
    plan = []
    with patch.object(prstate, "pr_context_for_repo", return_value=context):
        res = sgo.prepare_branch(intent, gate.evaluate(R), plan)
    assert res.branch == "feat/a" and res.cut is False
    assert any("continuing in-flight PR #7" in line for line in plan)


def test_message_file_and_stdin_input():
    """Commit message via --message-file (path) or -F - (stdin) — the shell-escaping-free path
    for multi-line / quote-heavy messages (mirrors git -F / gh --body-file). Content round-trips
    exactly, including the chars that break inline shell quoting."""
    import io
    sgo = _load_script("commit_flow")
    ap = sgo._build_parser()
    msg = 'feat(x): subj\n\nbody "dq" (paren) $VAR `bt` \'apos\'.'
    p = "/tmp/dlut_msgfile.txt"
    Path(p).write_text(msg, encoding="utf-8")
    assert sgo._resolve_message(ap.parse_args(["push", "--message-file", p]), ap) == msg
    # -F - reads stdin
    old = sys.stdin
    sys.stdin = io.StringIO("from stdin\nbody")
    try:
        assert sgo._resolve_message(ap.parse_args(["push", "-F", "-"]), ap) == "from stdin\nbody"
    finally:
        sys.stdin = old

def test_only_canonical_commit_message_is_cleaned_after_success():
    """Only the selected worktree's canonical scratch is consumed; other files are not."""
    sgo = _load_script("commit_flow")
    root = Path("/tmp/dlut_commit_msg_cleanup")
    shutil.rmtree(root, ignore_errors=True)
    worktree = root / "worktree"
    main_checkout = root / "main"
    os.makedirs(worktree / ".devloop")
    os.makedirs(main_checkout / ".devloop")
    canonical = worktree / ".devloop/commit_msg"
    main_scratch = main_checkout / ".devloop/commit_msg"
    caller_owned = worktree / "message.txt"
    canonical.write_text("fix: canonical\n", encoding="utf-8")
    main_scratch.write_text("fix: main checkout\n", encoding="utf-8")
    caller_owned.write_text("fix: caller-owned\n", encoding="utf-8")
    intent = sgo.GitIntent(
        mode="commit", message="fix: canonical", requested_branch=None, target="main", base="origin/main", explicit_base=False,
        files=[], repo=str(worktree), source="test", invoke_cwd=str(worktree),
    )

    plan: list[str] = []
    sgo._cleanup_commit_message_file(str(caller_owned), intent, plan)
    sgo._cleanup_commit_message_file("-", intent, plan)
    assert caller_owned.exists() and canonical.exists() and main_scratch.exists() and plan == []

    sgo._cleanup_commit_message_file(".devloop/commit_msg", intent, plan)
    assert not canonical.exists() and caller_owned.exists() and main_scratch.exists()
    assert plan == ["removed one-shot .devloop/commit_msg"]

def test_commit_flow_retains_scratch_on_failure_and_cleans_on_success():
    """The lifecycle contract is wired around the whole flow, not just the cleanup helper."""
    import contextlib
    import io
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_commit_msg_lifecycle"
    shutil.rmtree(R, ignore_errors=True)
    os.makedirs(R)
    _git(R, "init", "-q", "-b", "main")
    _git(R, "config", "user.email", "t@t.t")
    _git(R, "config", "user.name", "t")
    Path(f"{R}/f").write_text("one\n")
    _git(R, "add", "f")
    _git(R, "commit", "-qm", "init")
    _git(R, "checkout", "-q", "-b", "feat/a")
    Path(f"{R}/f").write_text("two\n")
    scratch = Path(f"{R}/.devloop/commit_msg")
    scratch.parent.mkdir()
    scratch.write_text("fix: preserve retry input\n\nExplain why.\n", encoding="utf-8")

    original_prepare = sgo.prepare_branch
    try:
        def fail_prepare(*_args, **_kwargs):
            raise sgo.SmartError("forced failure")
        sgo.prepare_branch = fail_prepare
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            assert sgo.main(["commit", "--message-file", str(scratch), "--repo", R]) == 1
        assert scratch.exists()
    finally:
        sgo.prepare_branch = original_prepare

    from unittest.mock import patch
    from domain.commit import Prepared
    prepared = Prepared(R, "main", "a"*40, "b"*40, "c"*64, "tracked", (), ("a",))
    with patch.object(sgo.commit_domain, "prepare", return_value=prepared), patch.object(sgo.commit_domain, "create", return_value="d"*40) as commit, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        assert sgo.main(["commit", "--message-file", str(scratch), "--repo", R]) == 0
        assert commit.call_args.args[1] == "fix: preserve retry input\n\nExplain why."
    assert not scratch.exists()


def test_push_requires_cli_but_does_not_run_validation():
    # +case=`push-cli-unavailable` +link=`component://docs/repository.md`
    # Missing CLI never falls back to an SDK push; project checks remain skill-owned.
    from tempfile import TemporaryDirectory
    from unittest.mock import patch
    from domain import config

    flow = _load_script("commit_flow")
    with TemporaryDirectory() as temporary:
        root = Path(temporary)
        remote = root / "remote.git"
        remote.mkdir()
        _git(remote, "init", "--bare", "-q")
        repo = root / "checkout"
        repo.mkdir()
        _git(repo, "init", "-q", "-b", "feature")
        _git(repo, "config", "user.email", "fixture@example.invalid")
        _git(repo, "config", "user.name", "Fixture")
        _git(repo, "remote", "add", "origin", str(remote))
        (repo / "source.py").write_text("base")
        (repo / "Makefile").write_text("format lint test:\n\t@touch check-ran; exit 1\n")
        _git(repo, "add", "source.py", "Makefile")
        _git(repo, "commit", "-qm", "base")
        (repo / "source.py").write_text("changed")
        binary = root / "repocli"
        binary.write_text("#!/bin/sh\ntouch '" + str(root / "cli-ran") + "'\nexit 1\n")
        binary.chmod(0o755)
        # A local bare Git remote has no Forge; preserve real Git/staging/push execution.
        with patch.dict(os.environ, {
            "PATH": str(root) + os.pathsep + os.environ["PATH"], "DEVLOOP_REPOCLI": str(binary),
        }):
            assert flow.main(["push", "--repo", str(repo), "--message", "fix: source", "--file", "source.py"]) == 1
        assert _git_out(remote,"for-each-ref","--format=%(refname)","refs/heads/") == ""
        assert (root / "cli-ran").exists()
        assert not (repo / "check-ran").exists()


def test_inline_message_still_supported():
    """Back-compat: inline --message / -m is unchanged (just no longer the only option)."""
    sgo = _load_script("commit_flow")
    ap = sgo._build_parser()
    assert sgo._resolve_message(ap.parse_args(["push", "--message", "fix: x"]), ap) == "fix: x"
    assert sgo._resolve_message(ap.parse_args(["push", "-m", "fix: y"]), ap) == "fix: y"


def test_explicit_paths_use_repeatable_file_arguments():
    """每个 --file 对应一个 argv 路径：空格与逗号是文件名内容，不再充当列表协议。"""
    import contextlib
    import io

    sgo = _load_script("commit_flow")
    root = "/tmp/dlut_repeatable_file"
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(root)
    _git(root, "init", "-q", "-b", "feat/x")
    ap = sgo._build_parser()
    ns = ap.parse_args([
        "commit", "--message", "fix: x", "--repo", root,
        "--file", "a,b.py", "-f", "space name.py", "--file", "a,b.py",
    ])
    ns.message = sgo._resolve_message(ns, ap)
    assert sgo.resolve_intent(ns, root).files == ["a,b.py", "space name.py"]

    err = io.StringIO()
    raised = False
    try:
        with contextlib.redirect_stderr(err):
            ap.parse_args(["commit", "--message", "fix: x", "--files", "a.py,b.py"])
    except SystemExit:
        raised = True
    assert raised and "unrecognized arguments" in err.getvalue()

def test_message_required_with_hint():
    """Neither --message nor --message-file → exits with an actionable hint, not a bare usage dump."""
    import contextlib
    import io
    sgo = _load_script("commit_flow")
    ap = sgo._build_parser()
    err = io.StringIO()
    raised = False
    try:
        with contextlib.redirect_stderr(err):
            sgo._resolve_message(ap.parse_args(["push"]), ap)
    except SystemExit:
        raised = True
    assert raised and "--message-file" in err.getvalue()

def test_cli_repo_arg_flag_and_positional_equivalent():
    """The shared repo-target arg (command): --repo and the bare positional are equivalent
    spellings, the flag wins when both appear, and --repo is no longer swallowed as a
    positional — the original bug that made `run_lint.py --repo /x` die with
    "no subproject matches '--repo'"."""
    import command as cli
    ap = cli.ArgParser(prog="t")
    cli.add_repo_arg(ap)
    assert cli.repo_target(ap.parse_args([])) is None
    assert cli.repo_target(ap.parse_args(["/some/path"])) == "/some/path"            # positional
    assert cli.repo_target(ap.parse_args(["--repo", "/some/path"])) == "/some/path"  # flag, not swallowed
    assert cli.repo_target(ap.parse_args(["-r", "nb"])) == "nb"
    assert cli.repo_target(ap.parse_args(["pos", "--repo", "flag"])) == "flag"       # flag wins
    # positional=False (gcampr shape): only the flag, no bare positional repo
    ap2 = cli.ArgParser(prog="t2")
    cli.add_repo_arg(ap2, positional=False)
    assert cli.repo_target(ap2.parse_args(["--repo", "x"])) == "x"

def test_cli_argparser_hint_only_on_unrecognized():
    """cli.ArgParser appends extra_hints on 'unrecognized arguments' (the silent-misparse
    failure), but not on other errors (which already name the offending argument)."""
    import contextlib
    import io
    import command as cli
    ap = cli.ArgParser(prog="t", extra_hints=["USE --message-file"])
    ap.add_argument("mode", choices=["a", "b"])
    err = io.StringIO()
    with contextlib.redirect_stderr(err), contextlib.suppress(SystemExit):
        ap.parse_args(["a", "--nope"])                 # unrecognized → hint shown
    assert "USE --message-file" in err.getvalue()
    err2 = io.StringIO()
    with contextlib.redirect_stderr(err2), contextlib.suppress(SystemExit):
        ap.parse_args(["zzz"])                         # bad choice → no hint
    assert "USE --message-file" not in err2.getvalue()


if __name__ == "__main__":
    run_main(globals())

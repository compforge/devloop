#!/usr/bin/env python3
"""commit_flow 编排：staging 过滤、分支决策/切分、CLI 入参（message/title/repo）、PR 描述同步。

Standalone: `python3 devloop/tests/test_git_ops.py`（也 pytest-collectable）；共享设施见 _testkit.py。
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from _testkit import _FakeForge, _git, _git_out, _load_script, run_main  # noqa: E402  (bootstrap first)
from domain.context import PullRequest  # noqa: E402
from domain.forge import ForgeError  # noqa: E402


def test_workflow_entrypoints_are_executable():
    """Workflow wrappers may be invoked directly even though skills normally spell out `bash`."""
    scripts = Path(__file__).resolve().parent.parent / "scripts"
    missing = [path.name for path in scripts.glob("smart_*.sh") if not os.access(path, os.X_OK)]
    if not os.access(scripts / "branch.py", os.X_OK):
        missing.append("branch.py")
    assert missing == []


def test_sensitive_filter():
    is_sensitive = _load_script("commit_flow")._is_sensitive
    assert is_sensitive(".env") and is_sensitive("sub/.env.local")
    assert is_sensitive("a/.idea/x") and is_sensitive("pkg/__pycache__/m.pyc")
    assert not is_sensitive("src/main.py") and not is_sensitive("README.md")

def test_gitlink_guard_exempts_registered_submodule():
    """160000 守卫只拦**未注册**的嵌套仓（误 add 的 accident）；`.gitmodules` 注册过的
    submodule 指针 bump 是合法提交（super-repo 的本职就是 bump 指针），放行。"""
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_gitlink"; shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    Path(f"{R}/README").write_text("x"); _git(R, "add", "README"); _git(R, "commit", "-qm", "init")
    # 嵌套一个独立 git 仓：git add 会把它作为 160000 gitlink 收进 index
    S = f"{R}/sub"; os.makedirs(S)
    _git(S, "init", "-q"); _git(S, "config", "user.email", "t@t.t"); _git(S, "config", "user.name", "t")
    Path(f"{S}/f").write_text("1"); _git(S, "add", "f"); _git(S, "commit", "-qm", "s")
    # 未注册 → 拦，且 index 已回滚
    try:
        sgo.stage(R, [], [])
        assert False, "expected SmartError for unregistered gitlink"
    except sgo.SmartError as e:
        assert "gitlink" in str(e)
    assert _git_out(R, "diff", "--cached", "--name-only") == ""
    # 注册进 .gitmodules → 放行，gitlink 留在 index
    Path(f"{R}/.gitmodules").write_text('[submodule "sub"]\n\tpath = sub\n\turl = ./sub\n')
    sgo.stage(R, [], [])
    assert "sub" in _git_out(R, "diff", "--cached", "--name-only").splitlines()

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

def test_branch_create_requires_explicit_carry_for_dirty_tree():
    """Starting new work is clean by default; the commit-flow compatibility path can explicitly
    carry both tracked and untracked changes onto the fresh branch."""
    from domain import branch as branch_domain
    from domain.context import session

    R = "/tmp/dlut_cut"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q", "-b", "main"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    v = Path(f"{R}/v")
    # Mirror the session: feat lags main on the file the dirty edit touches. main advances v
    # "83"→"84"; feat (cut earlier) still has "83"; the uncommitted bump on feat also reaches "84".
    v.write_text("83"); _git(R, "add", "v"); _git(R, "commit", "-qm", "v83")
    _git(R, "checkout", "-q", "-b", "feat"); Path(f"{R}/x").write_text("1"); _git(R, "add", "x"); _git(R, "commit", "-qm", "feat")
    _git(R, "checkout", "-q", "main"); v.write_text("84"); _git(R, "add", "v"); _git(R, "commit", "-qm", "v84")
    _git(R, "checkout", "-q", "feat"); v.write_text("84")
    Path(f"{R}/new.txt").write_text("untracked")
    identity = session.SessionIdentity("test", "")

    try:
        branch_domain.create(R, "newb", "main", identity=identity)
        assert False, "dirty start-work must require explicit carry"
    except branch_domain.BranchError as exc:
        assert "working tree is dirty" in str(exc) and "--carry-changes" in str(exc)

    result = branch_domain.create(
        R,
        "newb",
        "main",
        carry_changes=True,
        identity=identity,
    )
    assert _git_out(R, "rev-parse", "--abbrev-ref", "HEAD") == "newb"
    assert v.read_text() == "84" and Path(f"{R}/new.txt").read_text() == "untracked"
    assert result.created and result.carried_changes and result.fork_from == "main"


def test_branch_create_refreshes_remote_base():
    """A new branch starts at the real remote target, not a stale origin/<target> mirror."""
    from domain import branch as branch_domain
    from domain.context import session

    root = Path("/tmp/dlut_branch_fresh")
    shutil.rmtree(root, ignore_errors=True)
    remote, repo = root / "remote.git", root / "repo"
    remote.mkdir(parents=True)
    _git(str(remote), "init", "-q", "--bare")
    repo.mkdir()
    _git(str(repo), "init", "-q", "-b", "main")
    _git(str(repo), "config", "user.email", "t@t.t")
    _git(str(repo), "config", "user.name", "t")
    (repo / "f").write_text("one")
    _git(str(repo), "add", "f"); _git(str(repo), "commit", "-qm", "one")
    first = _git_out(str(repo), "rev-parse", "HEAD")
    _git(str(repo), "remote", "add", "origin", str(remote))
    _git(str(repo), "push", "-qu", "origin", "main")
    (repo / "f").write_text("two")
    _git(str(repo), "add", "f"); _git(str(repo), "commit", "-qm", "two")
    latest = _git_out(str(repo), "rev-parse", "HEAD")
    _git(str(repo), "push", "-q", "origin", "main")
    _git(str(repo), "checkout", "-q", "-b", "old", first)
    _git(str(repo), "update-ref", "refs/remotes/origin/main", first)

    result = branch_domain.create(
        str(repo),
        "feat/fresh",
        "origin/main",
        identity=session.SessionIdentity("test", ""),
    )
    assert result.created and _git_out(str(repo), "rev-parse", "HEAD") == latest


def test_branch_create_records_new_identity_when_carry_conflicts():
    """Once checkout succeeds, a stash conflict must leave branch state truthful and recoverable."""
    from domain import branch as branch_domain
    from domain.context import RepoContext, session

    repo = "/tmp/dlut_branch_conflict"
    shutil.rmtree(repo, ignore_errors=True); os.makedirs(repo)
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@t.t"); _git(repo, "config", "user.name", "t")
    path = Path(repo, "f")
    path.write_text("base\n"); _git(repo, "add", "f"); _git(repo, "commit", "-qm", "base")
    _git(repo, "branch", "old")
    path.write_text("main\n"); _git(repo, "commit", "-qam", "main")
    _git(repo, "checkout", "-q", "old")
    path.write_text("dirty\n")

    try:
        branch_domain.create(
            repo,
            "feat/conflict",
            "main",
            carry_changes=True,
            identity=session.SessionIdentity("test", ""),
        )
        assert False, "conflicting carry must report a recoverable error"
    except branch_domain.BranchError as exc:
        assert "reapplying local changes conflicted" in str(exc)

    assert _git_out(repo, "branch", "--show-current") == "feat/conflict"
    assert "UU f" in _git_out(repo, "status", "--short")
    assert _git_out(repo, "stash", "list")
    assert RepoContext.load(repo).branch.local.fork_from == "main"


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
    with contextlib.redirect_stdout(output):
        rc = branch_cli.main(["create", "feat/cli", "--repo", repo, "--base", "main"])
    assert rc == 0 and _git_out(repo, "branch", "--show-current") == "feat/cli"
    assert "action=branch-create" in output.getvalue() and "recorded fork_from=main" in output.getvalue()


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
    intent = sgo.GitIntent(mode="mr", message="m", title="m", requested_branch=None,
                           target="main", base="origin/main", explicit_base=False,
                           files=[], repo=R, source="test", invoke_cwd=R)
    # healthy branch, no PR segment → gate finds no PR → continue on the current branch
    res = sgo.prepare_branch(intent, gate.evaluate(R), [])
    assert res.branch == "feat/a" and res.cut is False

    # in-flight: an OPEN PR for feat/a in the monitor-owned pr segment → gate picks it (open
    # wins, no SHA check) → continue + a self-narrating line built with the repo-level provider
    prstate.persist_pr(R, {"branch": "feat/a", "provider": "github", "pr_number": 7,
                           "prs": [{"number": 7, "state": "open", "source_branch": "feat/a"}]})
    plan = []
    res = sgo.prepare_branch(intent, gate.evaluate(R), plan)
    assert res.branch == "feat/a" and res.cut is False
    assert any("continuing in-flight PR #7" in line for line in plan)

def test_normalize_files_rebase():
    """--file 自动 rebase 到 repo-root 相对路径——调用方从 workspace 根 / server 子目录
    传来的路径不再死于裸 `git add` 报错;git 不认识的不存在路径保持原样。"""
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_nf"
    shutil.rmtree(R, ignore_errors=True)
    os.makedirs(f"{R}/repo/server", exist_ok=True)
    Path(f"{R}/repo/server/a.py").write_text("x")
    plan: list[str] = []
    assert sgo.normalize_files(f"{R}/repo", [f"{R}/repo/server/a.py"], "/", plan) == ["server/a.py"]
    assert any("rebased" in line for line in plan)
    assert sgo.normalize_files(f"{R}/repo", ["a.py"], f"{R}/repo/server", []) == ["server/a.py"]
    assert sgo.normalize_files(f"{R}/repo", ["server/a.py"], "/", []) == ["server/a.py"]   # 已正确 → 不动
    assert sgo.normalize_files(f"{R}/repo", ["gone.py"], "/", []) == ["gone.py"]           # 不存在 → 不动

def test_normalize_files_deleted_path_rebase():
    """已删除文件以 cwd 相对路径传入 --file 时也能 rebase——存在性检查对删除文件
    永远打不中(两边都不存在),改查 git 删除清单(ls-files -d);未跟踪的不存在路径
    仍原样透传,交给 git 报 pathspec。"""
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_nfd"
    shutil.rmtree(R, ignore_errors=True)
    os.makedirs(f"{R}/repo/server", exist_ok=True)
    repo = f"{R}/repo"
    _git(repo, "init", "-q"); _git(repo, "config", "user.email", "t@t.t"); _git(repo, "config", "user.name", "t")
    Path(f"{repo}/server/a.py").write_text("x")
    _git(repo, "add", "server/a.py"); _git(repo, "commit", "-qm", "i")
    os.remove(f"{repo}/server/a.py")
    plan: list[str] = []
    assert sgo.normalize_files(repo, ["a.py"], f"{repo}/server", plan) == ["server/a.py"]
    assert any("rebased" in line for line in plan)
    assert sgo.normalize_files(repo, ["server/a.py"], "/", []) == ["server/a.py"]  # 已是 repo 相对 → 不动
    assert sgo.normalize_files(repo, ["gone.py"], f"{repo}/server", []) == ["gone.py"]  # 未跟踪 → 不动

def test_version_bump_mix_hint():
    """版本 bump 与功能文件混在同一 commit → PLAN 软提示(不拦);单独 bump 不提示。"""
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_vb"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    Path(f"{R}/pyproject.toml").write_text('version = "0.0.1"\n')
    Path(f"{R}/a.py").write_text("x = 1\n")
    _git(R, "add", "."); _git(R, "commit", "-qm", "i")
    Path(f"{R}/pyproject.toml").write_text('version = "0.0.2"\n')
    Path(f"{R}/a.py").write_text("x = 2\n")
    _git(R, "add", ".")
    plan: list[str] = []
    sgo.warn_mixed_version_bump(R, plan)
    assert any("version bump" in line for line in plan)
    _git(R, "reset", "-q"); _git(R, "add", "pyproject.toml")
    plan = []
    sgo.warn_mixed_version_bump(R, plan)
    assert plan == []

def test_component_lint_target():
    """lint 戳记对齐 CI 入口:有 lint-ci(通常 uv sync 锁定工具链)优先于 lint,
    消灭'本地 lint 绿、CI lint-ci 红'的版本漂移。目标选择是 component 自己的事实（Component.lint_target）。"""
    from domain.repo_layout import Component
    D = "/tmp/dlut_lint"
    shutil.rmtree(D, ignore_errors=True); os.makedirs(D)
    Path(f"{D}/Makefile").write_text("lint:\n\ttrue\n")
    assert Component.at(D, D).lint_target() == "lint"
    Path(f"{D}/Makefile").write_text("lint:\n\ttrue\nlint-ci:\n\ttrue\n")
    assert Component.at(D, D).lint_target() == "lint-ci"
    Path(f"{D}/Makefile").write_text("test:\n\ttrue\n")
    assert Component.at(D, D).lint_target() is None

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
    assert sgo._resolve_message(ap.parse_args(["mr", "--message-file", p]), ap) == msg
    # -F - reads stdin
    old = sys.stdin
    sys.stdin = io.StringIO("from stdin\nbody")
    try:
        assert sgo._resolve_message(ap.parse_args(["mr", "-F", "-"]), ap) == "from stdin\nbody"
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
        mode="commit", message="fix: canonical", title="fix: canonical",
        requested_branch=None, target="main", base="origin/main", explicit_base=False,
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

    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        assert sgo.main(["commit", "--message-file", str(scratch), "--repo", R]) == 0
    assert not scratch.exists()
    assert _git_out(R, "log", "-1", "--format=%B") == "fix: preserve retry input\n\nExplain why."

def test_inline_message_still_supported():
    """Back-compat: inline --message / -m is unchanged (just no longer the only option)."""
    sgo = _load_script("commit_flow")
    ap = sgo._build_parser()
    assert sgo._resolve_message(ap.parse_args(["mr", "--message", "fix: x"]), ap) == "fix: x"
    assert sgo._resolve_message(ap.parse_args(["mr", "-m", "fix: y"]), ap) == "fix: y"


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
            sgo._resolve_message(ap.parse_args(["mr"]), ap)
    except SystemExit:
        raised = True
    assert raised and "--message-file" in err.getvalue()

def test_cli_repo_arg_flag_and_positional_equivalent():
    """The shared repo-target arg (lib.cli): --repo and the bare positional are equivalent
    spellings, the flag wins when both appear, and --repo is no longer swallowed as a
    positional — the original bug that made `run_lint.py --repo /x` die with
    "no subproject matches '--repo'"."""
    from lib import cli
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
    from lib import cli
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

def test_title_defaults_to_message_first_line():
    """--title omitted → PR title is the message's FIRST line, so a multi-line body can't yield a
    multi-line (invalid) PR title — the gcampr 422 that bit us."""
    sgo = _load_script("commit_flow")
    R = "/tmp/dlut_title"
    shutil.rmtree(R, ignore_errors=True); os.makedirs(R)
    _git(R, "init", "-q"); _git(R, "config", "user.email", "t@t.t"); _git(R, "config", "user.name", "t")
    _git(R, "checkout", "-q", "-b", "feat/a")
    Path(f"{R}/f").write_text("x"); _git(R, "add", "f"); _git(R, "commit", "-qm", "i")
    ap = sgo._build_parser()
    ns = ap.parse_args(["mr", "--message", "feat: subject\n\nlong body line", "--repo", R])
    ns.message = sgo._resolve_message(ns, ap)
    intent = sgo.resolve_intent(ns, R)
    assert intent.title == "feat: subject" and intent.message.endswith("long body line")
    # the body becomes the PR/MR description — the outlet that keeps titles one short line
    assert intent.description == "long body line"
    # single-line message → no description (forge gets body="", not a phantom paragraph)
    ns1 = ap.parse_args(["mr", "--message", "feat: subject only", "--repo", R])
    ns1.message = sgo._resolve_message(ns1, ap)
    assert sgo.resolve_intent(ns1, R).description == ""

def test_sync_pr_description_append_only():
    """sync_pr_description: sets an empty body, appends to a non-empty one (human edits
    survive), no-ops when the paragraph is already present (retry-safe), and a forge
    failure degrades to a PLAN note — never an exception (commit/push already landed)."""
    sgo = _load_script("commit_flow")
    pr = PullRequest(number=7, state="open", source_branch="feat/x")

    f = _FakeForge([pr])
    plan = []
    sgo.sync_pr_description(f, pr, "para one", plan)
    assert f.description(7) == "para one" and any("description" in line for line in plan)
    sgo.sync_pr_description(f, pr, "para two", [])           # append, not overwrite
    assert f.description(7) == "para one\n\npara two"
    sgo.sync_pr_description(f, pr, "para one", [])           # already present → no dup
    assert f.description(7) == "para one\n\npara two"
    sgo.sync_pr_description(f, pr, "", [])                   # nothing to sync → no-op
    assert f.description(7) == "para one\n\npara two"

    class _Broken(_FakeForge):
        def description(self, number):
            raise ForgeError("boom")
    plan = []
    sgo.sync_pr_description(_Broken([pr]), pr, "para", plan)  # non-fatal
    assert any("non-fatal" in line for line in plan)

    # mr-mode reuse path appends through the same helper
    orig = sgo.forge_for_repo
    try:
        f2 = _FakeForge([PullRequest(number=3, state="open", source_branch="feat/x", web_url="u/3")],
                        bodies={3: "original"})
        sgo.forge_for_repo = lambda repo: f2
        sgo.reuse_or_create_pr("/repo", "feat/x", "main", "t", "follow-up body", [])
        assert f2.description(3) == "original\n\nfollow-up body"
    finally:
        sgo.forge_for_repo = orig


if __name__ == "__main__":
    run_main(globals())

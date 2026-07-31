from __future__ import annotations

import os
import sys
import time
from pathlib import Path

HOOKS = Path(__file__).resolve().parent.parent / "hooks"
sys.path.insert(0, str(HOOKS.parent))

from _testkit import _git, _load_hook  # noqa: E402
from domain.context import session as session_lock  # noqa: E402


def test_current_identity_from_runtime_env(monkeypatch):
    for name in ("CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID", "CODEX_SESSION_ID"):
        monkeypatch.delenv(name, raising=False)
    assert session_lock.current_identity() == session_lock.SessionIdentity("unknown", "")

    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", "claude-session")
    assert session_lock.current_identity() == session_lock.SessionIdentity(
        "claude", "claude-session"
    )

    # CODEX_THREAD_ID is the Codex runtime's stable identity and wins over an
    # inherited Claude variable when commands are nested.
    monkeypatch.setenv("CODEX_THREAD_ID", "codex-thread")
    assert session_lock.current_identity() == session_lock.SessionIdentity(
        "codex", "codex-thread"
    )


def test_acquire_then_foreign_and_self(tmp_path):
    repo = str(tmp_path)
    # session A claims, with a live pid (this test process)
    assert session_lock.acquire(repo, "sess-A", "feat/x", pid=os.getpid()) is True
    assert (Path(repo) / ".devloop" / "claude.owner.lock").exists()
    assert session_lock.read(repo)["harness"] == "claude"

    # a different live session sees A as a foreign owner and cannot acquire
    owner = session_lock.foreign_owner(repo, "sess-B")
    assert owner is not None and owner["branch"] == "feat/x"
    assert session_lock.acquire(repo, "sess-B", "feat/y", pid=os.getpid()) is False

    # A is never foreign to itself
    assert session_lock.foreign_owner(repo, "sess-A") is None


def test_stale_owner_is_reclaimable(tmp_path):
    repo = str(tmp_path)
    dead_pid = 2**31 - 1  # almost certainly not a live process
    session_lock.acquire(
        repo, "sess-A", "feat/x", pid=dead_pid, now=time.time() - session_lock.OWNER_TTL_SEC - 1
    )
    # dead pid + expired ts → inactive → not blocking, reclaimable
    assert session_lock.foreign_owner(repo, "sess-B") is None
    assert session_lock.acquire(repo, "sess-B", "feat/y", pid=os.getpid()) is True
    assert session_lock.read(repo)["session_id"] == "sess-B"


def test_release_own_lock_frees_checkout_immediately(tmp_path):
    repo = str(tmp_path)
    session_lock.acquire(repo, "sess-A", "feat/x", pid=os.getpid())
    # neither another session nor a blank one can release A's lock
    assert session_lock.release(repo, "sess-B") is False
    assert session_lock.release(repo, "") is False
    assert session_lock.read(repo)["session_id"] == "sess-A"
    # owner's normal exit releases at once — next session needn't wait for liveness
    assert session_lock.release(repo, "sess-A") is True
    assert session_lock.read(repo) is None
    assert session_lock.acquire(repo, "sess-B", "feat/y", pid=os.getpid()) is True


def test_blank_session_never_gates_or_writes(tmp_path):
    repo = str(tmp_path)
    session_lock.acquire(repo, "sess-A", "feat/x", pid=os.getpid())
    # a CLI without a session id is never blocked and never overwrites the lock
    assert session_lock.acquire(repo, "", "feat/y") is True
    assert session_lock.read(repo)["session_id"] == "sess-A"


def test_ownership_is_scoped_by_harness(tmp_path):
    repo = str(tmp_path)
    assert session_lock.acquire(
        repo, "session1", "feat/codex", harness="codex", pid=os.getpid()
    )

    # A second Codex session is a guest of the first Codex session.
    assert session_lock.foreign_owner(repo, "session2", harness="codex") is not None
    assert not session_lock.acquire(
        repo, "session2", "feat/other", harness="codex", pid=os.getpid()
    )

    # Claude owns an independent lock and is unaffected by Codex ownership.
    assert session_lock.foreign_owner(repo, "session3", harness="claude") is None
    assert session_lock.acquire(
        repo, "session3", "feat/claude", harness="claude", pid=os.getpid()
    )
    assert session_lock.read(repo, "codex")["session_id"] == "session1"
    assert session_lock.read(repo, "claude")["session_id"] == "session3"
    assert (Path(repo) / ".devloop" / "codex.owner.lock").exists()
    assert (Path(repo) / ".devloop" / "claude.owner.lock").exists()


def test_fetch_does_not_claim_ownership(tmp_path):
    """只读参考别的仓（fetch + log + read）不得抢占它的 checkout ownership——曾有
    session 为看代码跑了一条 `git fetch` 就拿走 harness owner lock，把真正要改代码的
    session 挤去 worktree。fetch 不动 working tree，只该刷新 branch.json。"""
    pgr = _load_hook("posttool_git_refresh")
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(str(repo), "init", "-q")
    expected = {str(repo.resolve())}

    def roots(cmd, subcommands):
        return {str(Path(r).resolve()) for r in pgr.affected_roots(cmd, str(tmp_path), subcommands)}

    # 状态刷新面：fetch 仍触发（remote refs 变了，ahead/behind 要跟着刷）
    assert roots(f"cd {repo} && git fetch origin", pgr._STATE_SUBCOMMANDS) == expected
    # ownership 面：fetch 不触发；真正动 working tree / 分支的子命令才触发
    assert roots(f"cd {repo} && git fetch origin", pgr._OWNERSHIP_SUBCOMMANDS) == set()
    assert roots(f"cd {repo} && git checkout -b feat/x", pgr._OWNERSHIP_SUBCOMMANDS) == expected
    assert roots(f"cd {repo} && git pull", pgr._OWNERSHIP_SUBCOMMANDS) == expected

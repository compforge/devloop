"""devloop 测试共享设施（非测试文件）：hermetic bootstrap + 公共 helper。

import 本模块的副作用即完成两件 bootstrap（必须发生在任何 `domain.*` import 之前，
所以每个测试文件的第一条 import 都应是 _testkit）：
1. 把 skill scripts 目录加进 sys.path，使私有 `domain` package 可导入；
2. 把 DEVLOOP_CONFIG_DIR 指向空临时目录——测试绝不读开发机真实 ~/.devloop/config.json
   （否则全局 lifecycle 动作会在测试 repo 上运行）。
   需要 config 的测试各自写自己的。

各测试文件独立可跑（`devloop/scripts/python devloop/scripts/tests/test_xxx.py`，也 pytest-collectable）；
全量入口是 `run_all.py`。
"""
from __future__ import annotations

import atexit
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import replace
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = PLUGIN_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

_GCFG = "/tmp/dlut_global_cfg"
shutil.rmtree(_GCFG, ignore_errors=True)
os.makedirs(_GCFG, exist_ok=True)
os.environ["DEVLOOP_CONFIG_DIR"] = _GCFG
_repokit_home = tempfile.TemporaryDirectory(prefix="devloop-repokit-test-")
atexit.register(_repokit_home.cleanup)
os.environ["REPOKIT_HOME"] = _repokit_home.name

from harness_common import Forge as ForgeIdentity, Repository  # noqa: E402
from domain.context import PullRequest  # noqa: E402
from domain.forge import Comment, Forge, ForgeError, ForgeNotFound  # noqa: E402


class _FakeForge(Forge):
    """In-memory Forge for testing the workflow orchestration
    (reuse_or_create_pr) without HTTP — the port is small enough that this is trivial."""
    provider = "github"

    def __init__(self, prs, bodies=None):
        self._prs = {p.number: p for p in prs}
        self._bodies = dict(bodies or {})   # number → description text
        self.created = None

    def for_repository(self, path):
        return self

    def repository(self):
        return Repository(ForgeIdentity("github"), "fork/repo")

    def create(self, *, source_repository, source_branch, target_repository, target_branch, title, body=""):
        n = max(self._prs, default=0) + 1
        pr = PullRequest(number=n, state="open", source_branch=source_branch,
                         target_branch=target_branch, title=title, web_url=f"u/{n}",
                         source_repository=source_repository.path, target_repository=target_repository.path)
        self._prs[n] = pr
        self._bodies[n] = body
        self.created = pr
        return pr

    def get(self, number):
        if number not in self._prs:
            raise ForgeNotFound(str(number))
        return self._prs[number]

    def description(self, number):
        return self._bodies.get(number, "")

    def update(self, number, **fields):
        if "body" in fields:
            self._bodies[number] = fields["body"]
        return self._prs[number]

    def close(self, number):
        pr = self._prs[number]
        self._prs[number] = replace(pr, state="closed")
        return self._prs[number]

    def prs_for_branch(self, branch, *, source_repository=None):
        self.queried_source = source_repository
        return sorted((p for p in self._prs.values() if p.source_branch == branch),
                      key=lambda p: p.number, reverse=True)

    def recent(self, limit):
        return sorted(self._prs.values(), key=lambda p: p.number, reverse=True)[:limit]

    def open_pull_requests(self):
        return [p for p in self.recent(len(self._prs)) if p.is_open]

    def comments(self, number):
        return [Comment(author="x", body="y")]

    def comment(self, number, body, *, replyable=False, path="", line=None):
        if replyable:
            if not path:
                raise ForgeError("unanchored replyable comments not supported")
            self.diff_posted = getattr(self, "diff_posted", [])
            self.diff_posted.append((number, path, line, body))
            return
        if path or line is not None:
            raise ForgeError("standalone comments cannot have a diff anchor")
        self.posted = getattr(self, "posted", [])
        self.posted.append((number, body))

    def default_branch(self):
        return "main"

    def create_release(self, *, tag, target, name="", notes=""):
        raise NotImplementedError("Release publication belongs to repocli")

    def latest_release(self):
        raise NotImplementedError("Release queries belong to repocli")

def _load_from(base, name):
    spec = importlib.util.spec_from_file_location(name, str(base / f"{name}.py"))
    m = importlib.util.module_from_spec(spec)
    # 注册进 sys.modules 再 exec:dataclass(及其它按 __module__ 反查注解的机制)
    # 需要 sys.modules[m.__name__] 存在,否则被测模块里定义 @dataclass 直接炸
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m

def _load_script(name):
    return _load_from(SCRIPTS, name)

def _git(repo, *a):
    subprocess.run(["git", "-c", "core.hooksPath=/dev/null", *a], cwd=repo, check=True, capture_output=True)

def _git_out(repo, *a):
    return subprocess.run(["git", "-c", "core.hooksPath=/dev/null", *a], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def run_all(g: dict, label: str = "") -> tuple[int, list]:
    """跑 `g` 里所有 test_* 函数，返回 (总数, 失败名单)。各测试文件的 __main__ 和
    run_all.py 都走这里，保证输出与判定一致。"""
    tests = [v for k, v in sorted(g.items()) if k.startswith("test_") and callable(v)]
    failed = []
    for t in tests:
        try:
            t()
            print(f"  ✓ {t.__name__}")
        except Exception as e:
            print(f"  ✗ FAIL {t.__name__}: {e}")
            failed.append(t.__name__)
    tag = f" [{label}]" if label else ""
    print(f"RESULT{tag}:", "FAIL" if failed else f"ALL PASS ({len(tests)} tests)")
    return len(tests), failed


def run_main(g: dict) -> None:
    """单测试文件的 standalone 入口。"""
    _, failed = run_all(g)
    sys.exit(1 if failed else 0)


def _pr_context(repo, reader):
    """Isolated repocli state used by workflow composition tests."""
    from repokit.forge import PullRequestContext, PullRequestObserver
    from domain import worktree
    primary = worktree.primary(repo)
    source = reader.repository()
    reader._prs = {number: replace(pr, source_repository=pr.source_repository or source.path,
                                  target_repository=pr.target_repository or source.path)
                   for number, pr in reader._prs.items()}
    observer = PullRequestObserver(reader, forge=source.forge.name,
                                   home=Path(primary).parent / "repokit", connection="test")
    return PullRequestContext(observer, primary, source=source, targets=(source,))

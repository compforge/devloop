"""devloop 测试共享设施（非测试文件）：hermetic bootstrap + 公共 helper。

import 本模块的副作用即完成两件 bootstrap（必须发生在任何 `domain.*` / `lib.*` import 之前，
所以每个测试文件的第一条 import 都应是 _testkit）：
1. 把 skill scripts 目录加进 sys.path，使私有 `domain` / `lib` package 可导入；
2. 把 DEVLOOP_CONFIG_DIR 指向空临时目录——测试绝不读开发机真实 ~/.devloop/config.json
   （否则一个全局 lifecycle.pre_commit 会让 precommit-gate 在每个测试 repo 上生效、拦住 commit）。
   需要 config 的测试各自写自己的。

各测试文件独立可跑（`python3 devloop/scripts/tests/test_xxx.py`，也 pytest-collectable）；
全量入口是 `run_all.py`。
"""
from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = PLUGIN_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

_GCFG = "/tmp/dlut_global_cfg"
shutil.rmtree(_GCFG, ignore_errors=True)
os.makedirs(_GCFG, exist_ok=True)
os.environ["DEVLOOP_CONFIG_DIR"] = _GCFG

from domain.context import PullRequest  # noqa: E402
from domain.forge import Comment, Forge, ForgeError, ForgeNotFound, Release  # noqa: E402


class _FakeForge(Forge):
    """In-memory Forge for testing the domain composition (build_window) + orchestration
    (reuse_or_create_pr) without HTTP — the port is small enough that this is trivial."""
    provider = "github"

    def __init__(self, prs, bodies=None):
        self._prs = {p.number: p for p in prs}
        self._bodies = dict(bodies or {})   # number → description text
        self.created = None

    def create(self, *, source_branch, target_branch, title, body=""):
        n = max(self._prs, default=0) + 1
        pr = PullRequest(number=n, state="open", source_branch=source_branch,
                         target_branch=target_branch, title=title, web_url=f"u/{n}")
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

    def prs_for_branch(self, branch):
        return sorted((p for p in self._prs.values() if p.source_branch == branch),
                      key=lambda p: p.number, reverse=True)

    def recent(self, limit):
        return sorted(self._prs.values(), key=lambda p: p.number, reverse=True)[:limit]

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
        r = Release(tag=tag, name=name or tag, target=target, web_url=f"rel/{tag}",
                    created_at=f"t{tag}")
        self._releases = getattr(self, "_releases", [])
        self._releases.append(r)
        self.released = r
        self.released_notes = notes   # Release carries no body; capture it for assertions
        return r

    def latest_release(self):
        rels = getattr(self, "_releases", [])
        return rels[-1] if rels else None

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


def repocli_report(sources=(), tests=(), *, complete=True, scope="focused", diagnostics=(),
                   observations=(), schema=3, affected=None):
    """Hermetic CLI protocol fixture; executes a real subprocess, never host repocli."""
    from contextlib import contextmanager
    from tempfile import TemporaryDirectory
    from unittest.mock import patch

    @contextmanager
    def installed():
        with TemporaryDirectory() as root:
            cli = Path(root) / "repocli"
            cli.write_text(
                "#!/usr/bin/env python3\nimport json, sys\n"
                "import hashlib, subprocess\n"
                "from pathlib import Path\n"
                "repo = sys.argv[sys.argv.index('--repo')+1]\n"
                "if '--impact' in sys.argv: raise SystemExit(2)\n"
                "if sys.argv[1]=='diff':\n with (Path(repo)/'analysis.observed').open('a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\n"
                "digest=hashlib.sha256()\n"
                "names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=repo).decode().split('\\0')\n"
                "for name in sorted(set(names)-{''}):\n"
                " p=Path(repo)/name\n"
                " if p.is_file(): digest.update(name.encode()+b'\\0'+p.read_bytes())\n"
                "identity='sha256:'+digest.hexdigest()\n"
                "data = " + repr({"schemaVersion": schema, "complete": complete, "scope": scope,
                                  "snapshot": "sha256:" + "a" * 64,
                                  "sourceFiles": list(sources), "testFiles": list(tests),
                                  "affectedFiles": [{"path": path} for path in
                                                    (affected if affected is not None else dict.fromkeys([*sources, *tests]))],
                                  "diagnostics": list(diagnostics), "observations": list(observations)}) + "\n"
                "data.update(snapshot=identity, checkout=repo, input='commit' if '--head' in sys.argv else 'working_tree')\n"
                "if sys.argv[1]=='snapshot': data.update(complete=True, diagnostics=[])\n"
                "if sys.argv[1]=='snapshot': data.update(schemaVersion=1)\n"
                "print(json.dumps(data))\n"
            )
            cli.chmod(0o755)
            with patch.dict(os.environ, {"DEVLOOP_REPOCLI": str(cli)}):
                yield cli
    return installed()

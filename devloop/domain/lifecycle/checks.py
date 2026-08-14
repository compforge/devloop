"""Component validation：normalize 后执行 `lint` / `test` checks。

这些 checks 与 validate skill（run_lint.py / run_tests.py / run_validate.py）是同一段逻辑、
同一处盖 `.devloop` validation 戳——skill 侧是 CLI 入口，gate 侧是 dispatch 调用，跑的是
这里。stamp 在通过时盖，所以裸 `git commit` 的守卫（`rules/command/precommit_gate`）查到
的戳与 dispatch 跑出的结果一致。

handler 契约：`fn(repo, paths) -> HookResult`（`paths` = 相位边界冻结的本次改动范围，见
`lifecycle.base.dispatch`）。lint/test 是 inline gate——干实际活、失败返回
`ok=False` 可挡 commit。`capture=False`（skill 侧）让 make 直接走父进程 stdout（实时）；
`capture=True`（dispatch 并发跑）收口输出、失败时把尾部塞进 summary，避免并发 lint‖test 的
输出交错刷屏。
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from lib import ecosystem
from domain import repo as repo_model
from domain.context import RepoContext
from domain.repo_layout import Component
from domain.lifecycle.base import HookResult

_TAIL_LINES = 40   # 失败时回带的输出尾行数（够定位、不淹没 PLAN）
_FULL_SUITE_TEST_FILE_LIMIT = 20
_TEST_SCAN_SKIP = {
    ".git", ".venv", "venv", "node_modules", "vendor", "dist", "build", "target",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
}


def _aggregate(name: str, reason: str, results: list[HookResult], *, advisory: bool = False) -> HookResult:
    """把 lifecycle 对多 component 的 fan-out 收回一个 hook 结果。

    dispatch 的契约是每个 hook 名返回一个 HookResult；component 是该 hook 内部的执行范围，
    不应暴露成多个 lifecycle hook。

    0 个 component（本相位无改动）是合法结果、算过——`all([])` 恒 True，这正是「知道范围且为空 →
    干净跳过」该有的样子。此时只报 reason，不缀空 detail。
    """
    detail = "; ".join(r.summary for r in results)
    return HookResult(
        name,
        ok=all(r.ok for r in results),
        advisory=advisory,
        summary=f"{reason}; {detail}" if detail else reason,
        guidance=tuple(note for result in results for note in result.guidance),
    )


def _make(code_dir: str, target: str, *, capture: bool, sink: list[str]) -> int:
    """跑 `make <target>`。capture=False → 走父进程 stdout（实时）；True → 收口进 sink。"""
    header = f"--- make {target} (cwd={code_dir}) ---"
    if capture:
        sink.append(header)
        r = subprocess.run(["make", target], cwd=code_dir, capture_output=True, text=True)
        sink.append(r.stdout)
        sink.append(r.stderr)
        return r.returncode
    print(header)
    return subprocess.run(["make", target], cwd=code_dir).returncode


def _tail(sink: list[str]) -> str:
    lines = "".join(sink).splitlines()
    return "\n".join(lines[-_TAIL_LINES:])


def _environment_failure(name: str, component: Component, *, advisory: bool = False) -> HookResult | None:
    """验证命令的环境前置条件：缺依赖先按生态 frozen 恢复，失败单列为环境错误。

    lint/test 会在 lifecycle 里并发进入；`ecosystem.ensure_ready` 自带 per-component single-flight，
    所以同一份 node_modules/.venv 只会有一个 writer。
    """
    problem = ecosystem.ensure_ready(component.path)
    if problem is None:
        return None
    return HookResult(name, ok=False, advisory=advisory,
                      summary=f"environment setup failed in {component.path}: {problem}")


def _has_large_test_suite(component: Component) -> bool:
    """测试文件超过内置小套件阈值时才值得 focused；扫描到第 21 个立即停止。"""
    eco = ecosystem.detect(component.path)
    if eco is None:
        return False
    found = 0
    for root, dirs, files in os.walk(component.path):
        dirs[:] = [name for name in dirs if name not in _TEST_SCAN_SKIP and not name.startswith(".")]
        for name in files:
            if eco.is_test_file(Path(root) / name):
                found += 1
                if found > _FULL_SUITE_TEST_FILE_LIMIT:
                    return True
    return False


def _changed_test_files(repo: str, component: Component, paths: list[str]) -> list[str]:
    """把仓相对 diff 路径筛成 component 相对、仍存在的测试文件。"""
    eco = ecosystem.detect(component.path)
    if eco is None:
        return []
    repo_root = Path(repo).resolve()
    component_root = Path(component.path).resolve()
    selected: list[str] = []
    for path in paths:
        absolute = repo_root / path
        if not absolute.is_file():
            continue
        try:
            relative = absolute.resolve().relative_to(component_root).as_posix()
        except ValueError:
            continue
        if eco.is_test_file(relative) and relative not in selected:
            selected.append(relative)
    return selected


def normalize(repo: str, *, capture: bool = True, component: Component | None = None,
              paths: list[str] | None = None) -> HookResult:
    """在 checks 前执行 Component 的可选 `make fix`；它是准备步骤，不是验证结果。

    lifecycle 与手动 validate 都必须先完成 normalize，再让 lint/test 并发观察同一份稳定代码。
    fixer 的退出码不直接判定验证：部分 fixer 会用非零表示改过文件，后续只读 lint 才是权威结果。
    """
    if component is None:
        ws = repo_model.select_components(repo, paths=paths)
        results = [normalize(repo, capture=capture, component=u) for u in ws.components]
        return _aggregate("normalize", ws.reason, results)
    if not component.has_target("fix"):
        return HookResult("normalize", ok=True, summary=f"no make fix target in {component.path} — skipped")
    env_failure = _environment_failure("normalize", component)
    if env_failure is not None:
        return env_failure

    sink: list[str] = []
    rc = _make(component.path, "fix", capture=capture, sink=sink)
    suffix = "" if rc == 0 else f" (exit {rc}; lint remains authoritative)"
    return HookResult("normalize", ok=True, summary=f"make fix completed{suffix}")


def lint(repo: str, *, capture: bool = True, component: Component | None = None,
         paths: list[str] | None = None) -> HookResult:
    """跑只读 lint target；通过则给当前内容指纹盖 lint 戳。

    `component` 给出即用它（CLI 已按操作目标选好）；否则是 lifecycle gate 入口，按本次改动选 WorkSet
    并 fan-out，避免多 component 仓静默回落 server / 仓根。`paths`（相位边界冻结的改动范围）给出即用它，
    不再自己读工作树——commit 后工作树已干净，读出来会是「无改动」→ 退化成跑全仓。
    跑 lint 前清 `.mypy_cache`：热缓存对一棵冷跑会被标红的树报过绿，一个能放行坏 MR 的戳比慢
    一点更糟。无 lint target → 干净跳过（ok，无可验证）。
    """
    if component is None:
        ws = repo_model.select_components(repo, paths=paths)
        results = [lint(repo, capture=capture, component=u) for u in ws.components]
        return _aggregate("lint", ws.reason, results)
    code_dir = component.path
    target = component.lint_target()
    if target is None:
        return HookResult("lint", ok=True, summary=f"no make lint/lint-ci target in {code_dir} — skipped")
    env_failure = _environment_failure("lint", component)
    if env_failure is not None:
        return env_failure

    sink: list[str] = []
    shutil.rmtree(Path(code_dir) / ".mypy_cache", ignore_errors=True)
    rc = _make(code_dir, target, capture=capture, sink=sink)
    if rc == 0:
        ctx = RepoContext.load(repo) or RepoContext.refresh_all(repo)
        # 指纹在**此刻**算：`make fix` 刚改过文件，跑之前算的指纹配不上刚被验过的这棵树——
        # 盖上去就等于给一份没验过的内容发通行证。
        ctx.mark_lint_passed(component.id, repo_model.component_fingerprint(repo, component) or "")
        return HookResult("lint", ok=True, summary=f"make {target} passed — stamped")
    detail = f"\n{_tail(sink)}" if capture else ""
    return HookResult("lint", ok=False, summary=f"make {target} failed (only `make fix` may edit files){detail}")


def test(repo: str, *, capture: bool = True, extra: list[str] | None = None,
         component: Component | None = None, paths: list[str] | None = None) -> HookResult:
    """跑 component 的 canonical test 命令（Make target 或 Go module 的 `go test ./...`）；
    通过则盖 test 戳。无 test 命令 → 干净跳过。`component` 给出即用它；否则按本次改动
    选 WorkSet 并 fan-out，使 gcampr lifecycle 与 validate skill 的选择逻辑一致。
    `paths` 同 `lint`：相位边界冻结的改动范围，给出即用它，不自己读工作树。

    **advisory（软提示）**：失败只通报、不阻断 commit/MR。test 挂常因基线坏测 / 环境，与本次
    diff 未必有关；要不要拦该看「diff 是否与挂掉的测试相关」，那需 baseline-aware 分析（TODO），
    现阶段先不硬拦，把判断交给 CI / 人。lint 仍是硬拦截。"""
    if component is None:
        ws = repo_model.select_components(repo, paths=paths)
        # lifecycle 传入的 paths 是相位边界冻结的 scope；pre_commit 未显式 --file 时才现读工作树。
        # 把同一份列表继续传到 component，避免 test 再引入第二套 diff 查询。
        effective_paths = paths if paths is not None else repo_model.changed_paths(repo)
        results = [
            test(repo, capture=capture, extra=extra, component=u, paths=effective_paths)
            for u in ws.components
        ]
        return _aggregate("test", ws.reason, results, advisory=True)
    code_dir = component.path
    command = component.test_command()
    if command is None:
        return HookResult("test", ok=True, advisory=True, summary=f"no test command in {code_dir} — skipped")
    env_failure = _environment_failure("test", component, advisory=True)
    if env_failure is not None:
        return env_failure

    extra = extra or []
    explicitly_narrowed = bool(extra)
    focused_files: list[str] = []
    focused = False
    guidance: tuple[str, ...] = ()
    if paths is not None and not extra and _has_large_test_suite(component):
        focused_files = _changed_test_files(repo, component, paths)
        focused_command = component.focused_test_command(focused_files)
        if focused_command is not None:
            command = focused_command
            focused = True
        elif focused_files and component.test_target() is not None and not component.supports_test_files():
            guidance = (
                f"{code_dir}/Makefile 未消费 TEST_FILES；本轮已回退完整 make test。"
                "请让 test target 在 TEST_FILES 非空时只运行这些 Component 相对测试文件。",
            )
    argv = [*command, *extra]
    display = " ".join(argv)
    sink: list[str] = []
    header = f"--- {display} (cwd={code_dir}) ---"
    if capture:
        sink.append(header)
        r = subprocess.run(argv, cwd=code_dir, capture_output=True, text=True)
        sink += [r.stdout, r.stderr]
        rc = r.returncode
    else:
        print(header)
        rc = subprocess.run(argv, cwd=code_dir).returncode
    if rc == 0:
        if focused:
            return HookResult(
                "test",
                ok=True,
                advisory=True,
                summary=f"{display} passed — focused {len(focused_files)} changed test file(s); "
                        "component test stamp unchanged",
                guidance=guidance,
            )
        if explicitly_narrowed:
            return HookResult(
                "test",
                ok=True,
                advisory=True,
                summary=f"{display} passed — narrowed by explicit test arguments; "
                        "component test stamp unchanged",
                guidance=guidance,
            )
        ctx = RepoContext.load(repo) or RepoContext.refresh_all(repo)
        ctx.mark_test_passed(component.id)
        return HookResult(
            "test",
            ok=True,
            advisory=True,
            summary=f"{display} passed — stamped",
            guidance=guidance,
        )
    detail = f"\n{_tail(sink)}" if capture else ""
    return HookResult(
        "test",
        ok=False,
        advisory=True,
        summary=f"{display} failed (advisory — not blocking){detail}",
        guidance=guidance,
    )

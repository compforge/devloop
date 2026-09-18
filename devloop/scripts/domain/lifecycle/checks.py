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

from concurrent.futures import ThreadPoolExecutor
import shutil
import subprocess
from pathlib import Path
from time import monotonic

from lib import ecosystem
from domain import repo as repo_model
from domain.context import RepoContext
from domain.repo_layout import Component
from domain.lifecycle.base import HookResult
from domain.validation import Plan, build_plan, content_identity

_TAIL_LINES = 40   # 失败时回带的输出尾行数（够定位、不淹没 PLAN）
_SLOW_FULL_TEST_SECONDS = 10.0
_MAX_COMPONENT_TEST_WORKERS = 8


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
        summary=(detail or reason) if name in {"lint", "test"} else (f"{reason}; {detail}" if detail else reason),
        guidance=tuple(note for result in results for note in result.guidance) +
                 ((f"selection: {reason}",) if name in {"lint", "test"} and detail and reason else ()),
    )


def _progress(check: str, component: Component, state: str, elapsed: float | None = None) -> None:
    """并发 capture 时只打印一行边界事件，保留实时感且不让子进程输出互相穿插。"""
    timing = f" ({elapsed:.1f}s)" if elapsed is not None else ""
    print(f"[validate] {check} {component.id}: {state}{timing}", flush=True)


def _make(component: Component, target: str, *, capture: bool, sink: list[str],
          args: tuple[str, ...] = ()) -> tuple[int, float]:
    """跑 `make <target>`，返回退出码与耗时。capture=True 时输出简短实时进度。"""
    code_dir = component.path
    command = ["make", target, *args]
    header = f"--- {' '.join(command)} (cwd={code_dir}) ---"
    started_at = monotonic()
    if capture:
        _progress(target, component, "started")
        sink.append(header)
        r = subprocess.run(command, cwd=code_dir, capture_output=True, text=True)
        sink.append(r.stdout)
        sink.append(r.stderr)
        elapsed = monotonic() - started_at
        _progress(target, component, "passed" if r.returncode == 0 else "failed", elapsed)
        return r.returncode, elapsed
    print(header)
    rc = subprocess.run(command, cwd=code_dir).returncode
    return rc, monotonic() - started_at


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


def _changed_lint_files(repo: str, component: Component, paths: list[str] | None) -> list[str]:
    """将已冻结的仓相对范围投影到 Component；删除和无法表示的路径回退全量。"""
    root = Path(repo).resolve()
    component_root = Path(component.path).resolve()
    files: list[str] = []
    for path in paths or []:
        absolute = root / path
        try:
            relative = absolute.relative_to(component_root).as_posix()
        except ValueError:
            continue
        if not absolute.is_file() or absolute.is_symlink():
            return []
        if relative not in files:
            files.append(relative)
    return files


def normalize(repo: str, *, capture: bool = True, component: Component | None = None,
              paths: list[str] | None = None) -> HookResult:
    """在 checks 前执行 Component 的可选 `make fix`；它是准备步骤，不是验证结果。

    lifecycle 与手动 validate 都必须先完成 normalize，再让 lint/test 并发观察同一份稳定代码。
    fixer 的退出码不直接判定验证：部分 fixer 会用非零表示改过文件，后续只读 lint 才是权威结果。
    """
    if component is None:
        ws = repo_model.select_components(repo, paths=paths)
        results = [normalize(repo, capture=capture, component=u, paths=paths) for u in ws.components]
        return _aggregate("normalize", ws.reason, results)
    if not component.has_target("fix"):
        return HookResult(
            "normalize",
            ok=True,
            summary=f"no make fix target in {component.path} — skipped",
            guidance=(
                f"{component.path}/Makefile 未提供 fix target；"
                "请补充可重复执行的 make fix 入口，作为 lint 前唯一允许改写源码的 normalize 步骤。",
            ),
        )
    env_failure = _environment_failure("normalize", component)
    if env_failure is not None:
        return env_failure

    sink: list[str] = []
    command = component.focused_lint_command(_changed_lint_files(repo, component, paths), target="fix")
    args = command[2:] if command else ("LINT_FILES=",)
    rc, elapsed = _make(component, "fix", capture=capture, sink=sink, args=args)
    suffix = "" if rc == 0 else f" (exit {rc}; lint remains authoritative)"
    return HookResult("normalize", ok=True, summary=f"make fix completed in {elapsed:.1f}s{suffix}")


def _identity_problem(repo: str, plan: Plan | None, phase: str) -> str:
    if plan is None or not plan.execution_identity:
        return ""
    observed = content_identity(repo)
    if observed.problem:
        return f"cannot verify contents {phase}: {observed.problem}; validation not stamped"
    if observed.digest != plan.execution_identity:
        return f"contents changed {phase}; rerun validation"
    return ""


def lint_components(repo: str, workset: repo_model.WorkSet, *, capture: bool = True,
                    paths: list[str] | None = None, plan: Plan | None = None) -> HookResult:
    """顺序 lint 已选中的 Component；仅全量通过时为该 Component 盖戳。"""
    results = [lint(repo, capture=capture, component=unit, paths=paths, plan=plan) for unit in workset.components]
    return _aggregate("lint", workset.reason, results)


def lint(repo: str, *, capture: bool = True, component: Component | None = None,
         paths: list[str] | None = None, plan: Plan | None = None) -> HookResult:
    """跑项目 lint target；按文件通过只用于本轮 gate，全量通过才盖 Component 戳。

    `component` 给出即用它（CLI 已按操作目标选好）；否则是 lifecycle gate 入口，按本次改动选 WorkSet
    并 fan-out，避免多 component 仓静默回落 server / 仓根。`paths`（相位边界冻结的改动范围）给出即用它，
    不再自己读工作树——commit 后工作树已干净，读出来会是「无改动」→ 退化成跑全仓。
    跑 lint 前清 `.mypy_cache`：热缓存对一棵冷跑会被标红的树报过绿，一个能放行坏 MR 的戳比慢
    一点更糟。无 lint target → 干净跳过（ok，无可验证）。
    """
    if component is None:
        ws = repo_model.select_components(repo, paths=paths)
        plan = plan or build_plan(repo, ws, paths=paths, checks=("lint",))
        return lint_components(repo, plan.workset, capture=capture, paths=paths, plan=plan)
    if problem := _identity_problem(repo, plan, "after planning"):
        return HookResult("lint", ok=False, summary=problem)
    code_dir = component.path
    target = component.lint_target()
    if target is None:
        return HookResult("lint", ok=True, summary=f"no make lint/lint-ci target in {code_dir} — skipped")
    env_failure = _environment_failure("lint", component)
    if env_failure is not None:
        return env_failure

    sink: list[str] = []
    shutil.rmtree(Path(code_dir) / ".mypy_cache", ignore_errors=True)
    files = (list(plan.selection(component, "lint").files) if plan else
             _changed_lint_files(repo, component, paths))
    command = component.focused_lint_command(files)
    guidance = ()
    if not component.supports_lint_files():
        guidance = (
            f"{code_dir}/Makefile 未消费 LINT_FILES；本轮运行全量 lint。"
            "如需按改动文件校验，请让 fix 和 lint targets 同时支持 LINT_FILES，空值保留全量行为。",
        )
    args = command[2:] if command else ("LINT_FILES=",)
    fingerprint = repo_model.component_fingerprint(repo, component)
    rc, elapsed = _make(component, target, capture=capture, sink=sink, args=args)
    if rc == 0 and (problem := _identity_problem(repo, plan, "during lint")):
        return HookResult("lint", ok=False, summary=problem)
    if rc == 0 and (fingerprint is None or fingerprint != repo_model.component_fingerprint(repo, component)):
        return HookResult("lint", ok=False, summary="contents changed during lint; validation not stamped")
    if rc == 0 and command:
        # spec: focused lint 只验证当前选择，不能授予整个 Component 的可复用通行证。
        return HookResult(
            "lint", ok=True,
            summary=f"make {target} passed in {elapsed:.1f}s — focused {len(files)} changed file(s); "
                    "component lint stamp unchanged",
        )
    if rc == 0:
        if plan and not plan.execution_identity:
            return HookResult("lint", ok=True, summary=f"full lint passed; validation not stamped: {plan.identity_problem or 'input identity unavailable'}")
        ctx = RepoContext.load(repo) or RepoContext.refresh_all(repo)
        # Bind the stamp to the input fingerprint verified before and after execution.
        ctx.mark_lint_passed(component.id, fingerprint)
        return HookResult("lint", ok=True, summary=f"make {target} passed in {elapsed:.1f}s — stamped",
                          guidance=guidance)
    detail = f"\n{_tail(sink)}" if capture else ""
    return HookResult(
        "lint",
        ok=False,
        summary=f"make {target} failed after {elapsed:.1f}s (only `make fix` may edit files){detail}",
        guidance=guidance,
    )


def test_components(
    repo: str,
    workset: repo_model.WorkSet,
    *,
    capture: bool = True,
    extra: list[str] | None = None,
    paths: list[str] | None = None,
    plan: Plan | None = None,
) -> HookResult:
    """有界并行测试已选中的 Component，并在 join 后批量写 test stamp。"""
    def run(unit: Component) -> tuple[HookResult, bool]:
        return _test_component(
            repo, capture=capture, extra=extra, component=unit, paths=paths, plan=plan,
        )

    # Component 是相互独立的验证单位；worker 只执行命令、不写 validation segment，
    # join 后由父线程一次落盘，避免多个 component 覆写同一份 test.json。
    if len(workset.components) > 1:
        with ThreadPoolExecutor(
            max_workers=min(_MAX_COMPONENT_TEST_WORKERS, len(workset.components)),
        ) as executor:
            outcomes = list(executor.map(run, workset.components))
    else:
        outcomes = [run(unit) for unit in workset.components]
    results = [result for result, _ in outcomes]
    passed = [
        unit.id
        for unit, (_, should_stamp) in zip(workset.components, outcomes)
        if should_stamp
    ]
    if passed:
        ctx = RepoContext.load(repo) or RepoContext.refresh_all(repo)
        ctx.mark_tests_passed(passed)
    return _aggregate("test", workset.reason, results, advisory=True)


def test(repo: str, *, capture: bool = True, extra: list[str] | None = None,
         component: Component | None = None, paths: list[str] | None = None,
         plan: Plan | None = None) -> HookResult:
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
        plan = plan or build_plan(repo, ws, paths=effective_paths, checks=("test",), test_extra=extra)
        return test_components(
            repo, plan.workset, capture=capture, extra=extra, paths=effective_paths, plan=plan,
        )
    result, should_stamp = _test_component(
        repo, capture=capture, extra=extra, component=component, paths=paths, plan=plan,
    )
    if should_stamp:
        ctx = RepoContext.load(repo) or RepoContext.refresh_all(repo)
        ctx.mark_test_passed(component.id)
    return result


def validate_components(repo: str, workset: repo_model.WorkSet, *,
                        names: tuple[str, ...] = ("lint", "test"),
                        paths: list[str] | None = None, full: bool = False,
                        explicit: bool = False, extra: list[str] | None = None) -> list[HookResult]:
    """Normalize first, analyze once, then share the plan across read-only checks."""
    selection_paths = paths
    if paths is None and not full:
        paths = repo_model.changed_paths(repo) or None
    prepared = [normalize(repo, capture=False, component=unit, paths=paths)
                for unit in workset.components]
    if any(not result.ok for result in prepared):
        return prepared
    plan = build_plan(repo, workset, paths=selection_paths, full=full, explicit=explicit, test_extra=extra, checks=names)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = []
        for name in names:
            if name == "lint":
                futures.append(executor.submit(lint_components, repo, plan.workset, paths=paths, plan=plan))
            else:
                futures.append(executor.submit(test_components, repo, plan.workset, plan=plan, extra=extra))
        checked = [future.result() for future in futures]
    return [_aggregate("normalize", workset.reason, prepared), *checked]


def _test_component(repo: str, *, capture: bool, extra: list[str] | None,
                    component: Component, paths: list[str] | None,
                    plan: Plan | None = None) -> tuple[HookResult, bool]:
    """执行一个 Component 的 test；bool 表示 join 后是否应写入全量 test 戳。"""
    if problem := _identity_problem(repo, plan, "after planning"):
        return HookResult("test", ok=False, advisory=True, summary=problem), False
    code_dir = component.path
    make_target = component.test_target()
    command = component.test_command()
    guidance: tuple[str, ...] = ()
    if make_target is None:
        guidance = (
            f"{code_dir}/Makefile 未提供 test target；请补充非交互、只读的 make test 入口。",
        )
    if command is None:
        return HookResult(
            "test",
            ok=True,
            advisory=True,
            summary=f"no test command in {code_dir} — skipped",
            guidance=guidance,
        ), False
    extra = extra or []
    supports_test_files = make_target is not None and component.supports_test_files()
    # spec: Empty TEST_FILES is a full-suite request only under the project's Make contract.
    # Other runner arguments can change coverage, so they never grant a full Component stamp.
    explicit_full = supports_test_files and bool(extra) and all(
        arg.startswith("TEST_FILES=") and not arg.partition("=")[2].strip() for arg in extra
    )
    unverified_scope = bool(extra) and not explicit_full
    focused_files: list[str] = []
    focused = False
    scope = "full"
    if extra:
        if unverified_scope:
            scope = "explicit (coverage not inferred)"
        reason = "empty TEST_FILES requests the full suite" if explicit_full else "caller supplied test arguments"
    elif plan is not None:
        selection = plan.selection(component, "test")
        focused_files = list(selection.files)
        focused_command = component.focused_test_command(focused_files)
        if focused_command:
            command = focused_command
            focused = True
            scope = "focused"
        reason = selection.reason
    else:
        reason = "no analysis plan; canonical full Component validation"
    argv = [*command, *extra]
    if make_target is not None and not focused and not extra:
        # Full coverage must not inherit a narrower TEST_FILES from the caller's environment.
        argv.append("TEST_FILES=")
    display = " ".join(argv)
    header = f"--- {display} (cwd={code_dir}) ---"
    print(f"[validate] test {component.id}: scope={scope} — {reason}\n{header}", flush=True)
    env_failure = _environment_failure("test", component, advisory=True)
    if env_failure is not None:
        return env_failure, False
    sink: list[str] = []
    fingerprint = repo_model.component_fingerprint(repo, component)
    started_at = monotonic()
    if capture:
        _progress("test", component, "started")
        sink.append(header)
        r = subprocess.run(argv, cwd=code_dir, capture_output=True, text=True)
        sink += [r.stdout, r.stderr]
        rc = r.returncode
    else:
        rc = subprocess.run(argv, cwd=code_dir).returncode
    elapsed = monotonic() - started_at
    if capture:
        _progress("test", component, "passed" if rc == 0 else "failed", elapsed)
    if not extra and make_target is not None and not supports_test_files and elapsed > _SLOW_FULL_TEST_SECONDS:
        guidance += (
            f"make {make_target} 完整运行耗时 {elapsed:.1f}s，且 Makefile 未消费 TEST_FILES；"
            "请让 test target 在 TEST_FILES 非空时只运行这些 Component 相对测试文件。",
        )
    if rc == 0:
        if problem := _identity_problem(repo, plan, "during tests"):
            return HookResult("test", ok=False, advisory=True, summary=problem), False
        if fingerprint is None or fingerprint != repo_model.component_fingerprint(repo, component):
            return HookResult("test", ok=False, advisory=True,
                              summary="contents changed during tests; validation not stamped"), False
        if focused:
            return HookResult(
                "test",
                ok=True,
                advisory=True,
                summary=f"{display} passed in {elapsed:.1f}s — focused {len(focused_files)} affected test file(s); "
                        "component test stamp unchanged",
                guidance=guidance,
            ), False
        if unverified_scope:
            return HookResult(
                "test",
                ok=True,
                advisory=True,
                summary=f"{display} passed in {elapsed:.1f}s — explicit test arguments; coverage not inferred; "
                        "component test stamp unchanged",
                guidance=guidance,
            ), False
        if plan and not plan.execution_identity:
            return HookResult("test", ok=True, advisory=True, summary=f"full tests passed; validation not stamped: {plan.identity_problem or 'input identity unavailable'}"), False
        return HookResult(
            "test",
            ok=True,
            advisory=True,
            summary=f"{display} passed in {elapsed:.1f}s — stamped",
            guidance=guidance,
        ), True
    detail = f"\n{_tail(sink)}" if capture else ""
    return HookResult(
        "test",
        ok=False,
        advisory=True,
        summary=f"{display} failed after {elapsed:.1f}s (advisory — not blocking){detail}",
        guidance=guidance,
    ), False

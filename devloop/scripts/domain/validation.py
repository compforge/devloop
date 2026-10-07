"""Validation planning owns repocli consumption; the CLI remains a neutral analyzer.

One immutable plan is shared by all checks in a transaction. Analysis failures
select canonical full commands; check failures never cause an analysis retry.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import subprocess
import time

from domain import repo as repo_model
from domain.repo_layout import Component, inspect_catalog
from domain.context.store import branch_segment, save_segment
from lib import gitcmd, repocli
from repocli import snapshot


@dataclass(frozen=True)
class Comparison:
    base: str = "HEAD"
    head: str = ""
    reason: str = ""


@dataclass(frozen=True)
class Selection:
    files: tuple[str, ...] = ()  # Component relative; empty defaults to full unless skipped.
    reason: str = ""
    explicit: bool = False
    skipped: bool = False

    @property
    def scope(self) -> str:
        if self.skipped:
            return "skipped"
        return "explicit" if self.explicit else ("focused" if self.files else "full")


@dataclass(frozen=True)
class Plan:
    workset: repo_model.WorkSet
    selections: dict[tuple[str, str], Selection] = field(default_factory=dict)
    snapshot: str = ""
    comparison: Comparison = Comparison()
    execution_identity: str = ""
    identity_problem: str = ""
    component_impacts: tuple[dict, ...] = ()

    def selection(self, component: Component, check: str) -> Selection:
        return self.selections[(component.id, check)]


@dataclass(frozen=True)
class ContentIdentity:
    digest: str = ""
    problem: str = ""


def content_identity(repo: str) -> ContentIdentity:
    """Native repocli content identity; unavailable inputs never authorize a stamp."""
    try:
        observed = snapshot(repo)
        if not observed.complete:
            return ContentIdentity(problem="; ".join(observed.diagnostics))
        return ContentIdentity(digest=observed.digest)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        return ContentIdentity(problem=str(exc))



def _relative(repo: str, component: Component, paths: list[str]) -> list[str]:
    root = Path(repo).resolve()
    result = []
    for path in paths:
        absolute = root / path
        # Deleted paths, symlinks and unsupported Make arguments require full checks.
        if not absolute.is_file() or absolute.is_symlink():
            raise ValueError("selected input is deleted or not a regular file")
        if root not in absolute.resolve().parents:
            raise ValueError("selected input escapes repository")
        try:
            result.append(absolute.relative_to(Path(component.path).resolve()).as_posix())
        except ValueError:
            continue
    return result


def build_plan(repo: str, workset: repo_model.WorkSet, *, paths: list[str] | None = None,
               full: bool = False, explicit: bool = False,
               comparison: Comparison | None = None,
               test_extra: list[str] | None = None,
               checks: tuple[str, ...] = ("lint", "test")) -> Plan:
    """Analyze once after normalization, including dependencies outside dirty owners."""
    comparison = comparison or Comparison()
    inspection = inspect_catalog(repo)
    catalog = inspection.components
    units = workset.components if explicit else catalog
    reason = "explicit full Component validation" if full else comparison.reason
    affected_files: list[str] = []
    tests: list[str] = []
    snapshot = ""
    analysis_reason = "repocli automatic impact"
    component_impacts: tuple[dict, ...] = ()
    observed = content_identity(repo)
    identity = observed.digest
    if paths == [] and not full:
        plan = Plan(repo_model.WorkSet((), "no changed paths"), comparison=comparison)
        persist_plan(repo, plan)
        return plan
    if not reason:
        argv = ["--base", comparison.base, "--test-dir", "."]
        if comparison.head:
            argv += ["--head", comparison.head]
        for path in paths or []:
            argv += ["--changed-file", path]
        try:
            # A commit report describes committed bytes. Dirty execution contents cannot
            # inherit its focused scope, even if the dirty files are outside the seeds.
            if comparison.head and repo_model.changed_paths(repo):
                raise ValueError("working tree differs from committed analysis target")
            data = repocli.read_report(repo, "diff", argv)
            report = repocli.decode_diff(data, repo, "commit" if comparison.head else "working_tree")
            diagnostics = report.diagnostics
            # Missing relationships limit coverage, not the usability of returned
            # files. Status and diagnostics explain the selection without widening it.
            if not report.complete or report.scope != "focused" or diagnostics:
                codes = sorted({str(d.get("code", "analysis_gap")) for d in diagnostics})
                detail = ": " + ", ".join(codes) if codes else ""
                analysis_reason += " (partial analysis" + detail + ")"
            snapshot = report.snapshot
            if not identity or snapshot != identity or identity != content_identity(repo).digest:
                raise ValueError("execution contents differ from analyzed snapshot")
            component_impacts = report.components
            affected_files = list(report.affected_files)
            tests = list(report.test_files)
            if not explicit:
                affected = repo_model.select_components(repo, paths=list(dict.fromkeys(affected_files + tests)), catalog=inspection)
                units = tuple({u.id: u for u in (*workset.components, *affected.components)}.values())
                if not units and (affected_files or tests):
                    raise ValueError("no Component owns the selected files")
        except (OSError, subprocess.TimeoutExpired, ValueError, TypeError) as exc:
            reason = f"repocli fallback: {exc}"
            units = workset.components if explicit else catalog
    selections = {}
    for unit in units:
        impact_gaps = [str(reason) for impact in component_impacts
                       if impact.get("root") == unit.id
                       for reason in impact.get("fallbackReasons", [])]
        unit_analysis_reason = analysis_reason + ("; " + "; ".join(impact_gaps) if impact_gaps else "")
        for check, files in (("lint", affected_files), ("test", tests)):
            if check not in checks:
                continue
            selection_reason = reason
            relative = []
            skipped = False
            if not selection_reason:
                try:
                    owned = [path for path in files
                             if (owner := inspection.owner(inspection.root / path)) is not None
                             and owner.id == unit.id]
                    relative = _relative(repo, unit, owned)
                    if not relative:
                        # Empty Make file-list variables request full checks, while
                        # an empty valid analysis result explicitly selects no files.
                        skipped = True
                        selection_reason = unit_analysis_reason + f"; no returned {check} files in Component"
                    else:
                        command = (unit.focused_lint_command(relative) if check == "lint"
                                   else unit.focused_test_command(relative))
                        if not command:
                            selection_reason = "no usable selection or project file-list contract; canonical full check"
                            relative = []
                except ValueError as exc:
                    selection_reason = str(exc)
                    relative = []
            if check == "test" and test_extra:
                explicit_full = unit.supports_test_files() and all(
                    arg.startswith("TEST_FILES=") and not arg.partition("=")[2].strip()
                    for arg in test_extra)
                selections[(unit.id, check)] = Selection(reason="caller supplied test arguments", explicit=not explicit_full)
            else:
                selections[(unit.id, check)] = Selection(
                    tuple(relative), selection_reason or unit_analysis_reason, skipped=skipped)
    if reason:
        observed = content_identity(repo)
    plan = Plan(repo_model.WorkSet(units, reason or "repocli affected Components"), selections,
                snapshot, comparison, observed.digest, observed.problem, component_impacts)
    persist_plan(repo, plan)
    return plan


def persist_plan(repo: str, plan: Plan) -> None:
    branch = gitcmd.git(repo, "branch", "--show-current").out or None
    payload = {
        "generated_at": time.time(), "base": plan.comparison.base, "head": plan.comparison.head,
        "snapshot": plan.snapshot,
        "component_impacts": list(plan.component_impacts),
        "execution_identity": plan.execution_identity, "identity_problem": plan.identity_problem,
        "checks": [{"component": component, "check": check, "scope": selection.scope,
                    "reason": selection.reason, "files": list(selection.files)}
                   for (component, check), selection in plan.selections.items()],
    }
    save_segment(repo, branch_segment(branch, "validation_scope"), payload)
    if plan.identity_problem:
        print(f"[validate] snapshot unavailable — {plan.identity_problem}; checks may run, results cannot be stamped", flush=True)
    for item in payload["checks"]:
        print(f"[validate] {item['check']} {item['component']}: scope={item['scope']} — {item['reason']}", flush=True)

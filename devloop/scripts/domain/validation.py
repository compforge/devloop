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
from domain.repo_layout import Catalog, Component, inspect_catalog
from domain.context.store import branch_segment, save_segment
from lib import git_state, repocli
from repocli import snapshot


VALIDATION_TAGS = frozenset({"source", "test", "config", "manifest", "lockfile"})


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



def _relative_files(root: Path, component: Component, paths: list[str]) -> tuple[str, ...]:
    """Selected files must be runnable inside the owning Makefile's checkout boundary."""
    files = []
    for path in dict.fromkeys(paths):
        absolute = root / path
        if not absolute.is_file() or absolute.is_symlink():
            raise ValueError("selected input is deleted or not a regular file")
        if not absolute.resolve().is_relative_to(root.resolve()):
            raise ValueError("selected input escapes checkout")
        files.append(absolute.relative_to(component.path).as_posix())
    return tuple(files)


def build_plan(repo: str, workset: repo_model.WorkSet, *, paths: list[str] | None = None,
               full: bool = False, explicit: bool = False,
               comparison: Comparison | None = None,
               test_extra: list[str] | None = None,
               checks: tuple[str, ...] = ("lint", "test")) -> Plan:
    """Analyze once after normalization, including dependencies outside dirty owners.

    +spec=`Automatic checks require a positive source/test/config/manifest/lockfile tag count; other tags and analysis gaps do not trigger checks`
    +spec=`Unsupported impact schemas or missing/invalid affectedFileCounts stop validation without compatibility fallback`
    +spec=`Component selects the Makefile; affectedFiles/testFiles select check inputs`
    +why=`An execution boundary is not a request for full coverage; focused passes retain focused evidence`
    +spec=`Post-normalization Component metadata and impact come from one report; checks share that plan`
    +link=component://docs/repository-toolkit.md
    """
    comparison = comparison or Comparison()
    if workset.catalog is not None and not workset.catalog.components:
        plan = Plan(repo_model.WorkSet((), "no recognized Components; validation not run"), comparison=comparison)
        persist_plan(repo, plan)
        return plan
    requested = {unit.id for unit in workset.components} if explicit else None
    reason = "explicit full Component validation" if full else comparison.reason
    snapshot = ""
    analysis_reason = "repocli automatic impact"
    component_impacts: tuple[dict, ...] = ()
    files_by_check: dict[str, tuple[str, ...]] = {}
    observed = content_identity(repo)
    identity = observed.digest
    if paths == [] and not (full or explicit or test_extra):
        plan = Plan(repo_model.WorkSet((), "no changed paths"), comparison=comparison)
        persist_plan(repo, plan)
        return plan
    if not reason:
        argv = ["--base", comparison.base]
        if comparison.head:
            argv += ["--head", comparison.head]
        for path in paths or []:
            argv += ["--changed-file", path]
        try:
            # A commit report describes committed bytes. Dirty execution contents cannot
            # inherit its focused scope, even if the dirty files are outside the seeds.
            if comparison.head and repo_model.changed_paths(repo):
                raise ValueError("working tree differs from committed analysis target")
            data = repocli.read_report(repo, "impact", argv)
            report = repocli.decode_impact(data, repo, "commit" if comparison.head else "working_tree")
            diagnostics = report.diagnostics
            # Gaps remain visible but do not override the validation tag whitelist.
            if not report.complete or report.scope != "focused" or diagnostics:
                codes = sorted({str(d.get("code", "analysis_gap")) for d in diagnostics})
                detail = ": " + ", ".join(codes) if codes else ""
                analysis_reason += " (partial analysis" + detail + ")"
            snapshot = report.snapshot
            if not identity or snapshot != identity or identity != content_identity(repo).digest:
                raise ValueError("execution contents differ from analyzed snapshot")
            files_by_check = {"lint": report.affected_files, "test": report.test_files}
            component_impacts = report.components
            inspection = Catalog.from_layout(repo, report.layout)
            current = {item["root"]: item for item in component_impacts if item["snapshot"] == "after"}
            units = tuple(unit for unit in inspection.components
                          if (unit.id in requested if requested is not None else
                              test_extra or current[unit.id]["affected"] or not current[unit.id]["complete"]
                              or any(current[unit.id]["affectedFileCounts"].values())))
        except repocli.ImpactProtocolError:
            raise
        except (OSError, subprocess.TimeoutExpired, ValueError, TypeError) as exc:
            reason = f"repocli fallback: {exc}"
    if reason:
        # Fix may change manifests. Full/fallback checks observe the current catalog,
        # never reuse the pre-normalization view as execution metadata.
        inspection = inspect_catalog(repo)
        units = tuple(unit for unit in inspection.components if requested is None or unit.id in requested)
    selections = {}
    for unit in units:
        impact = next((item for item in component_impacts
                       if item["root"] == unit.id and item["snapshot"] == "after"), None)
        selection_reason = reason or analysis_reason + ("; explicit Component boundary" if explicit else "")
        if impact and not reason:
            counts = ", ".join(f"{tag}={count}" for tag, count in sorted(impact["affectedFileCounts"].items()))
            selection_reason += "; affectedFileCounts: " + (counts or "{}")
            if impact["affected"]:
                selection_reason += "; affected Component"
            elif not impact["complete"]:
                selection_reason += "; unknown Component impact"
            if gaps := impact.get("fallbackReasons", []):
                selection_reason += "; " + "; ".join(gaps)
        for check in checks:
            if check == "test" and test_extra:
                explicit_full = unit.supports_test_files() and all(
                    arg.startswith("TEST_FILES=") and not arg.partition("=")[2].strip()
                    for arg in test_extra)
                selections[(unit.id, check)] = Selection(reason="caller supplied test arguments", explicit=not explicit_full)
            elif not reason and not explicit and impact is not None and not any(
                    impact["affectedFileCounts"].get(tag, 0) > 0 for tag in VALIDATION_TAGS):
                selections[(unit.id, check)] = Selection(
                    skipped=True, reason=selection_reason + "; validation tag whitelist not matched")
            else:
                files: tuple[str, ...] = ()
                check_reason = selection_reason
                if not reason:
                    try:
                        owned = [path for path in files_by_check.get(check, ())
                                 if (owner := inspection.owner(inspection.root / path)) is not None
                                 and owner.id == unit.id]
                        files = _relative_files(inspection.root, unit, owned)
                        command = (unit.focused_lint_command(list(files)) if check == "lint"
                                   else unit.focused_test_command(list(files)))
                        if not command:
                            detail = (f"no returned {check} files in selected Component" if not files
                                      else "project file-list contract missing or paths not representable")
                            check_reason += f"; {detail}; canonical full check"
                            files = ()
                    except ValueError as exc:
                        check_reason += f"; {exc}; canonical full check"
                        files = ()
                selections[(unit.id, check)] = Selection(files=files, reason=check_reason)
    if reason:
        observed = content_identity(repo)
    selection_summary = reason or ("tag-based Component validation" if units else
                                   "repocli found no affected Components")
    plan = Plan(repo_model.WorkSet(units, selection_summary), selections,
                snapshot, comparison, observed.digest, observed.problem, component_impacts)
    persist_plan(repo, plan)
    return plan


def persist_plan(repo: str, plan: Plan) -> None:
    payload = {
        "generated_at": time.time(), "base": plan.comparison.base, "head": plan.comparison.head,
        "snapshot": plan.snapshot,
        "component_impacts": list(plan.component_impacts),
        "execution_identity": plan.execution_identity, "identity_problem": plan.identity_problem,
        "checks": [{"component": component, "check": check, "scope": selection.scope,
                    "reason": selection.reason, "files": list(selection.files)}
                   for (component, check), selection in plan.selections.items()],
    }
    # A failed identity lookup is not detached HEAD. Keep the previous display
    # record rather than attribute this plan to the wrong branch; checks still run.
    try:
        branch = git_state.get_current_branch(repo)
    except OSError as exc:
        print(f"[validate] validation scope not recorded: {exc}", flush=True)
    else:
        save_segment(repo, branch_segment(branch, "validation_scope"), payload)
    if plan.identity_problem:
        print(f"[validate] snapshot unavailable — {plan.identity_problem}; checks may run, results cannot be stamped", flush=True)
    for item in payload["checks"]:
        print(f"[validate] {item['check']} {item['component']}: scope={item['scope']} — {item['reason']}", flush=True)

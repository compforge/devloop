"""Validation planning owns repocli consumption; the CLI remains a neutral analyzer.

One immutable plan is shared by all checks in a transaction. Analysis failures
select canonical full commands; check failures never cause an analysis retry.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import time

from domain import repo as repo_model
from domain.repo_layout import Component, discover_components
from domain.context.store import branch_segment, save_segment
from lib import gitcmd


@dataclass(frozen=True)
class Comparison:
    base: str = "HEAD"
    head: str = ""
    reason: str = ""


@dataclass(frozen=True)
class Selection:
    files: tuple[str, ...] = ()  # Component relative; empty means canonical full.
    reason: str = ""
    explicit: bool = False

    @property
    def scope(self) -> str:
        return "explicit" if self.explicit else ("focused" if self.files else "full")


@dataclass(frozen=True)
class Plan:
    workset: repo_model.WorkSet
    selections: dict[tuple[str, str], Selection] = field(default_factory=dict)
    snapshot: str = ""
    comparison: Comparison = Comparison()
    execution_identity: str = ""
    identity_problem: str = ""

    def selection(self, component: Component, check: str) -> Selection:
        return self.selections[(component.id, check)]


@dataclass(frozen=True)
class ContentIdentity:
    digest: str = ""
    problem: str = ""


def _repocli_json(repo: str, command: str, args: list[str]) -> dict:
    argv = [os.environ.get("DEVLOOP_REPOCLI", "repocli"), command, "--repo", repo,
            "--json", "--timeout", "30s", *args]
    completed = subprocess.run(argv, cwd=repo, capture_output=True, text=True,
                               timeout=35, check=False)
    if completed.returncode:
        detail = completed.stderr.strip()[-2000:]
        raise ValueError(f"repocli {command} exited {completed.returncode}" + (f": {detail}" if detail else ""))
    data = json.loads(completed.stdout)
    if not isinstance(data, dict):
        raise ValueError(f"repocli {command} returned a non-object report")
    return data


def content_identity(repo: str) -> ContentIdentity:
    """Use repocli's content contract; unavailable identity never authorizes a stamp."""
    try:
        data = _repocli_json(repo, "snapshot", [])
        if data.get("schemaVersion") != 1:
            raise ValueError("unsupported snapshot schema (requires 1)")
        if data.get("input") != "working_tree" or Path(data.get("checkout", "")).resolve() != Path(repo).resolve():
            raise ValueError("snapshot target mismatch")
        if data.get("complete") is not True or data.get("diagnostics") != []:
            diagnostics = data.get("diagnostics") or []
            detail = "; ".join(str(d.get("message") or d.get("code", "unknown gap"))
                               for d in diagnostics[:3] if isinstance(d, dict))
            raise ValueError("snapshot incomplete" + (f": {detail}" if detail else ""))
        digest = data.get("snapshot")
        if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError("invalid snapshot identity")
        return ContentIdentity(digest=digest)
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError) as exc:
        return ContentIdentity(problem=str(exc))


def _paths(value: object) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("file list missing")
    for path in value:
        if (not isinstance(path, str) or not path or PurePosixPath(path).is_absolute()
                or ".." in PurePosixPath(path).parts or "\x00" in path):
            raise ValueError("invalid repository-relative path")
    return value


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
    catalog = tuple(discover_components(repo))
    units = workset.components if explicit else catalog
    reason = "explicit full Component validation" if full else comparison.reason
    sources: list[str] = []
    tests: list[str] = []
    snapshot = ""
    observed = content_identity(repo)
    identity = observed.digest
    if paths == [] and not full:
        plan = Plan(repo_model.WorkSet((), "no changed paths"), comparison=comparison)
        persist_plan(repo, plan)
        return plan
    if not reason:
        argv = ["--base", comparison.base, "--impact", "file", "--test-dir", "."]
        if comparison.head:
            argv += ["--head", comparison.head]
        for path in paths or []:
            argv += ["--changed-file", path]
        try:
            # A commit report describes committed bytes. Dirty execution contents cannot
            # inherit its focused scope, even if the dirty files are outside the seeds.
            if comparison.head and repo_model.changed_paths(repo):
                raise ValueError("working tree differs from committed analysis target")
            data = _repocli_json(repo, "diff", argv)
            if not isinstance(data, dict) or data.get("schemaVersion") != 2:
                raise ValueError("unsupported repocli schema (requires 2)")
            if (data.get("complete") is not True or data.get("scope") != "focused"
                    or data.get("diagnostics")):
                diagnostics = data.get("diagnostics") or []
                codes = sorted({str(d.get("code", "analysis_gap")) for d in diagnostics if isinstance(d, dict)})
                raise ValueError("analysis incomplete" + (": " + ", ".join(codes) if codes else ""))
            if data.get("impactMode") != "file" or Path(data.get("checkout", "")).resolve() != Path(repo).resolve():
                raise ValueError("analysis target mismatch")
            snapshot = data.get("snapshot", "")
            if not isinstance(snapshot, str) or len(snapshot) != 71 or not snapshot.startswith("sha256:"):
                raise ValueError("missing snapshot identity")
            if data.get("input") != ("commit" if comparison.head else "working_tree"):
                raise ValueError("analysis input mismatch")
            if not identity or snapshot != identity or identity != content_identity(repo).digest:
                raise ValueError("execution contents differ from analyzed snapshot")
            sources, tests = _paths(data.get("sourceFiles")), _paths(data.get("testFiles"))
            if not sources and not tests:
                raise ValueError("no usable changed selection")
            if not explicit:
                affected = repo_model.select_components(repo, paths=list(dict.fromkeys(sources + tests)))
                units = tuple({u.id: u for u in (*workset.components, *affected.components)}.values())
                if not units:
                    raise ValueError("no Component owns the selected files")
        except (OSError, subprocess.TimeoutExpired, ValueError, TypeError) as exc:
            reason = f"repocli fallback: {exc}"
            units = workset.components if explicit else catalog
    selections = {}
    for unit in units:
        for check, files in (("lint", sources), ("test", tests)):
            if check not in checks:
                continue
            selection_reason = reason
            relative = []
            if not selection_reason:
                try:
                    relative = _relative(repo, unit, files)
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
                selections[(unit.id, check)] = Selection(tuple(relative), selection_reason or "repocli file dependencies")
    if reason:
        observed = content_identity(repo)
    plan = Plan(repo_model.WorkSet(units, reason or "repocli affected Components"), selections,
                snapshot, comparison, observed.digest, observed.problem)
    persist_plan(repo, plan)
    return plan


def persist_plan(repo: str, plan: Plan) -> None:
    branch = gitcmd.git(repo, "branch", "--show-current").out or None
    payload = {
        "generated_at": time.time(), "base": plan.comparison.base, "head": plan.comparison.head,
        "snapshot": plan.snapshot,
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

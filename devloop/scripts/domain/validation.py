"""Development workflow over repocli's validation commands.

Repocli owns plans, execution and reuse. This adapter owns preparation policy,
branch association, report storage and lifecycle gate decisions.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import subprocess
import tempfile
import time

from repocli import snapshot
from domain.context.store import branch_segment, load_segment, save_segment
from domain.repo_layout import Catalog, inspect_catalog
from domain.lifecycle.base import HookResult
from domain.validation_evidence import evidence_segment, bind_full
from lib import config, dependencies, git_state, repocli


@dataclass(frozen=True)
class Comparison:
    base: str = "HEAD"
    head: str = ""
    reason: str = ""


@dataclass(frozen=True)
class ContentIdentity:
    digest: str = ""
    problem: str = ""


def content_identity(repo: str) -> ContentIdentity:
    try:
        observed = snapshot(repo)
        return ContentIdentity(digest=observed.digest) if observed.complete else ContentIdentity(problem="; ".join(observed.diagnostics))
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        return ContentIdentity(problem=str(exc))


@dataclass(frozen=True)
class ValidationOutcome:
    results: tuple[HookResult, ...]
    execution_identity: str = ""


def _policy(repo: str) -> dict:
    value = config.load(repo).get("validation", {})
    if not isinstance(value, dict) or not isinstance(value.get("inputs", {}), dict):
        raise ValueError("validation.inputs must be a Component/check mapping")
    return value


def _inputs(repo: str, catalog: Catalog, policy: dict, names: tuple[str, ...]) -> dict:
    declarations = policy.get("inputs", {})
    result = {}
    receipts = {unit.id: dependencies.reuse_inputs(unit.path) for unit in catalog.components}
    for unit in catalog.components:
        configured = declarations.get(unit.id, {})
        if not isinstance(configured, dict):
            raise ValueError(f"invalid validation.inputs for {unit.id}")
        result[unit.id] = {}
        for name in names:
            declaration = dict(configured.get(name, {}))
            if set(declaration) - {"components", "paths"}:
                raise ValueError(f"unknown input declaration fields for {unit.id}/{name}")
            related = {unit.id, *declaration.get("components", [])}
            if not related <= receipts.keys():
                raise ValueError(f"unknown input Component for {unit.id}/{name}")
            witnesses = {path for root in related for path, _ in receipts[root] or ()}
            declaration["witnesses"] = sorted(witnesses)
            declaration["disableReuse"] = any(receipts[root] is None for root in related)
            result[unit.id][name] = declaration
    return result


def _previous(repo: str, catalog: Catalog, names: tuple[str, ...]) -> dict:
    groups = []
    for unit in catalog.components:
        checks = []
        binding = None
        for name in names:
            record = load_segment(repo, evidence_segment(repo, unit.id, name)) or {}
            report = record.get("report", {})
            if not record.get("eligible") or report.get("schemaVersion") != 1 or not report.get("inputsConsistent"):
                continue
            if report.get("checkout") != str(Path(repo).resolve()):
                continue
            for group in report.get("components", []):
                if group["component"]["root"] == unit.id:
                    binding = group["component"]
                    checks.extend(check for check in group["checks"] if check["check"] == name)
        if binding:
            groups.append({"component": binding, "checks": checks})
    return {"schemaVersion": 1, "checkout": str(Path(repo).resolve()), "inputsConsistent": True, "components": groups}


def _record(repo: str, report: dict, eligible: bool, comparison: Comparison) -> None:
    branch = git_state.get_current_branch(repo)
    save_segment(repo, branch_segment(branch, "validation"), {"report": report, "eligible": eligible, "base": comparison.base, "head": comparison.head})
    summaries = []
    for group in report["components"]:
        root = group["component"]["root"]
        for check in group["checks"]:
            summaries.append({"component": root, "check": check["check"], "scope": check["scope"],
                              "reason": check["reason"], "files": check["files"], "command": check["command"],
                              "requestedComponents": check["requestedComponents"], "reuse": check["reuseReason"]})
            if check["status"] == "skipped":
                continue
            # Preserve the original result, including its original execution timestamp.
            single = {**report, "components": [{**group, "checks": [check]}]}
            record = {"report": single, "eligible": eligible, "checked_at": check["checkedAt"]}
            sources = check["requestedComponents"]
            for source in set([root, *sources]):
                save_segment(repo, evidence_segment(repo, source, check["check"]), record)
            if eligible and check["status"] == "passed" and check["scope"] == "full":
                bind_full(repo, list(set([root, *sources])), check["check"])
    save_segment(repo, branch_segment(branch, "validation_scope"), {
        "generated_at": time.time(), "base": comparison.base, "head": comparison.head,
        "snapshot": report["snapshot"], "execution_identity": report["snapshot"] if eligible else "",
        "component_impacts": (report.get("impact") or {}).get("components", []),
        "unowned": (report.get("impact") or {}).get("unowned"),
        "checks": summaries, "identity_problem": "" if eligible else "validation inputs changed",
    })


def _results(report: dict, names: tuple[str, ...], eligible: bool) -> tuple[HookResult, ...]:
    results = []
    preparation_failed = any(check["status"] not in {"passed", "skipped", "unavailable"}
                             for group in report.get("preparation", []) for check in group["checks"])
    for name in names:
        checks = [(group["component"]["root"], check) for group in report["components"]
                  for check in group["checks"] if check["check"] == name]
        failed = not eligible or not report["complete"] or preparation_failed or any(check["status"] not in {"passed", "skipped", "unavailable"} for _, check in checks)
        status = ("failed" if failed else "unavailable" if any(c["status"] == "unavailable" for _, c in checks)
                  else "passed" if any(c["status"] == "passed" for _, c in checks) else "skipped")
        lines = []
        for root, check in checks:
            reuse = "reused" if check["reused"] else check["status"]
            lines.append(f"{root}: {name} {reuse} ({check['scope']}) — {check['reason']}; {check['reuseReason']}")
            if check["status"] not in {"passed", "skipped", "unavailable"}:
                lines.append("\n".join((check["stdout"] + check["stderr"]).splitlines()[-40:]))
        lines.extend(report.get("diagnostics", []))
        if preparation_failed:
            lines.append("make format failed; checks were not started")
            lines.extend("\n".join((check["stdout"] + check["stderr"]).splitlines()[-40:])
                         for group in report.get("preparation", []) for check in group["checks"]
                         if check["status"] not in {"passed", "skipped", "unavailable"})
        if not eligible:
            lines.append("input consistency not established; no passing evidence recorded")
        results.append(HookResult(name, ok=not failed, advisory=name == "test", status=status,
                                  summary="; ".join(lines) or "no selected checks"))
    return tuple(results)


def run_validation(repo: str, *, names: tuple[str, ...] = ("lint", "test"),
                   components: tuple[str, ...] | None = None, paths: list[str] | None = None,
                   full: bool = False, comparison: Comparison | None = None,
                   concurrency: int = 2, format: bool = True) -> ValidationOutcome:
    """One CLI round for all requested checks, shared by lifecycle and manual workflow.

    +spec=`Repocli owns scope, command, fingerprints and reuse; devloop only supplies workflow context`
    +spec=`Input inconsistency blocks lint even when unavailable checks are non-blocking`
    +why=`Harness host environment is not the environment in which checks executed`
    """
    comparison = comparison or Comparison()
    if not full and not comparison.reason and comparison.base in {"HEAD", "HEAD^"} and not git_state.target_exists(repo, comparison.base):
        comparison = Comparison(reason="initial history has no comparison revision; full checks")
    if paths == [] and not full and components is None:
        return ValidationOutcome(tuple(HookResult(name, True, status="skipped", advisory=name == "test", summary="no changed paths") for name in names))
    catalog = inspect_catalog(repo)
    for unit in catalog.components:
        if components is not None and unit.id not in components:
            continue
        if problem := dependencies.preparation_problem(unit.path):
            raise ValueError(f"{unit.id}: dependency preparation failed: {problem}")
    policy = _policy(repo)
    inputs = _inputs(repo, catalog, policy, names)
    previous = _previous(repo, catalog, names)
    args = ["--check", ",".join(("format", *names) if format else names), "--concurrency", str(concurrency)]
    if components is not None:
        if not components:
            return ValidationOutcome(tuple(HookResult(name, True, status="skipped", advisory=name == "test", summary="no Components") for name in names))
        for root in components:
            args += ["--component", root]
    if not full and not comparison.reason:
        args += ["--base", comparison.base]
        for path in paths or []:
            args += ["--changed-file", path]
    with tempfile.TemporaryDirectory(prefix="devloop-validation-") as temporary:
        inputs_path, previous_path = Path(temporary) / "inputs.json", Path(temporary) / "previous.json"
        inputs_path.write_text(json.dumps(inputs))
        previous_path.write_text(json.dumps(previous))
        args += ["--inputs", str(inputs_path), "--reuse", str(previous_path)]
        print(f"[validate] repocli: checks={','.join(names)}, concurrency={concurrency}, base={comparison.reason or (comparison.base if not full else 'full')}", flush=True)
        report = repocli.validation_report(repo, args)
    eligible = report["inputsConsistent"] and policy == _policy(repo)
    _record(repo, report, eligible, comparison)
    return ValidationOutcome(_results(report, names, eligible), report["snapshot"] if eligible else "")

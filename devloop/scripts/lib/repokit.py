"""Native repository facts and the Go CLI impact protocol boundary."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import repokit as toolkit
from repokit import InspectReport, PackageTool as PackageTool, owner as owner


class InspectionError(ValueError):
    """Unavailable organization must not become an empty or fabricated catalog."""


def inspect(repo: str) -> InspectReport:
    """Toolkit owns organization; devloop owns acceptance and execution containment."""
    try:
        report = toolkit.inspect(repo, timeout=5)
        if not report.complete or report.diagnostics:
            raise ValueError("repository inspection incomplete")
        root = Path(repo).resolve()
        for binding in report.components:
            # Recheck containment even if a directory disappears after inspection;
            # validation must not follow a replaced ancestor outside the checkout.
            if not (root / binding.root).resolve().is_relative_to(root):
                raise ValueError("component root escapes checkout")
        return report
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise InspectionError(f"repository inspection unavailable: {exc}") from exc


def validation_report(repo: str, args: list[str]) -> dict:
    """Read successful and failed rounds alike; exit 1 can carry a valid report."""
    timeout = 600
    argv = [os.environ.get("DEVLOOP_REPOCLI", "repocli"), "validate", "--repo", repo,
            "--json", "--timeout", f"{timeout}s", *args]
    completed = subprocess.run(argv, cwd=repo, capture_output=True, text=True,
                               timeout=timeout + 15, check=False)
    if completed.returncode not in (0, 1):
        raise ValueError(f"repocli validate exited {completed.returncode}: {completed.stderr[-2000:]}")
    try:
        data = json.loads(completed.stdout)
    except ValueError as exc:
        raise ValueError(f"repocli validate did not return a report: {completed.stderr[-2000:]}") from exc
    if not isinstance(data, dict) or data.get("schemaVersion") != 1:
        raise ValueError("unsupported ValidationReport; upgrade repocli")
    if data.get("checkout") != str(Path(repo).resolve()):
        raise ValueError("ValidationReport checkout mismatch")
    if any(type(data.get(key)) is not bool for key in ("inputsConsistent", "complete", "passed")):
        raise ValueError("invalid ValidationReport outcome")
    if not isinstance(data.get("snapshot"), str) or not data["snapshot"].startswith("sha256:"):
        raise ValueError("ValidationReport snapshot missing")
    if not isinstance(data.get("components"), list) or not isinstance(data.get("diagnostics"), list):
        raise ValueError("ValidationReport results missing")
    selected = set(args[args.index("--check") + 1].split(",")) - {"format"} if "--check" in args else {"lint", "test"}
    seen = set()
    coverage = {}
    for group in data["components"]:
        root = group["component"]["root"]
        if not isinstance(root, str) or not (Path(repo) / root).resolve().is_relative_to(Path(repo).resolve()):
            raise ValueError("ValidationReport Component escapes checkout")
        for check in group["checks"]:
            name = check["check"]
            if name not in selected or (root, name) in seen:
                raise ValueError("invalid or duplicate ValidationReport check")
            seen.add((root, name))
            sources = check.get("requestedComponents")
            if not isinstance(sources, list) or not sources or any(not isinstance(source, str) for source in sources) or len(set(sources)) != len(sources):
                raise ValueError("ValidationReport requestedComponents missing or duplicated")
            for source in sources:
                if not isinstance(source, str) or not (Path(repo) / source).resolve().is_relative_to(Path(repo).resolve()):
                    raise ValueError("ValidationReport requested Component escapes checkout")
                if name in coverage.setdefault(source, set()):
                    raise ValueError("duplicate requested Component check")
                coverage[source].add(name)
            if check["scope"] not in {"full", "focused", "skipped", "unavailable"} or check["status"] not in {
                    "passed", "failed", "skipped", "unavailable", "cancelled", "uncertain"}:
                raise ValueError("invalid validation check status or scope")
            if type(check["reused"]) is not bool or not isinstance(check["witnesses"], dict):
                raise ValueError("invalid validation evidence")
            if any(not isinstance(check.get(key), str) for key in ("checkedAt", "inputFingerprint", "environment", "reason", "reuseReason", "stdout", "stderr")):
                raise ValueError("incomplete validation check result")
            if any(not isinstance(check.get(key), list) or any(not isinstance(x, str) for x in check[key]) for key in ("command", "files")):
                raise ValueError("invalid validation command or file list")
    if any(checks != selected for checks in coverage.values()):
        raise ValueError("ValidationReport omitted requested checks")
    return data

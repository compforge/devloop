"""Native repository facts and the Go CLI impact protocol boundary."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path, PurePosixPath
from dataclasses import dataclass

import repocli as toolkit
from repocli import InspectReport, PackageTool as PackageTool, owner as owner


class InspectionError(ValueError):
    """Unavailable organization must not become an empty or fabricated catalog."""


class ImpactProtocolError(ValueError):
    """Unsupported impact contracts must stop automatic validation."""


def read_report(repo: str, command: str, args: list[str]) -> dict:
    timeout = 30
    argv = [os.environ.get("DEVLOOP_REPOCLI", "repocli"), command, "--repo", repo,
            "--json", "--timeout", f"{timeout}s", *args]
    completed = subprocess.run(argv, cwd=repo, capture_output=True, text=True,
                               timeout=timeout + 5, check=False)
    if completed.returncode:
        detail = completed.stderr.strip()[-2000:]
        raise ValueError(f"repocli {command} exited {completed.returncode}" + (f": {detail}" if detail else ""))
    data = json.loads(completed.stdout)
    if not isinstance(data, dict):
        raise ValueError(f"repocli {command} returned a non-object report")
    return data


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


@dataclass(frozen=True)
class ImpactReport:
    complete: bool
    scope: str
    diagnostics: tuple[dict, ...]
    snapshot: str
    components: tuple[dict, ...]
    affected_files: tuple[str, ...]
    test_files: tuple[str, ...]
    layout: toolkit.Layout


def _paths(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise ValueError("file list missing")
    for path in value:
        if (not isinstance(path, str) or not path or PurePosixPath(path).is_absolute()
                or ".." in PurePosixPath(path).parts or "\x00" in path):
            raise ValueError("invalid repository-relative path")
    return tuple(value)


def _impact_layout(impacts: list[dict], repo: str) -> toolkit.Layout:
    """Decode current Component metadata from the same report as impact facts."""
    bindings = []
    root = Path(repo).resolve()
    for item in impacts:
        if item["snapshot"] != "after":
            continue
        path = item["root"]
        if str(PurePosixPath(path)) != path or not path:
            raise ValueError("invalid Component root")
        directory = root / path
        if not directory.resolve().is_relative_to(root) or not directory.is_dir():
            raise ValueError(f"Component root is unavailable or escapes checkout: {path}")
        component = item["component"]
        language = component.get("language")
        if language is not None and not isinstance(language, str):
            raise ValueError("invalid Component language")
        tools = item.get("packageTools", [])
        if not isinstance(tools, list):
            raise ValueError("invalid Component package tools")
        package_tools = []
        for tool in tools:
            if (not isinstance(tool, dict) or not isinstance(tool.get("name"), str)
                    or not tool["name"] or not isinstance(tool.get("evidence", []), list)
                    or any(not isinstance(e, str) for e in tool.get("evidence", []))
                    or not isinstance(tool.get("version", ""), str)):
                raise ValueError("invalid Component package tool")
            package_tools.append(PackageTool(tool["name"], tuple(tool.get("evidence", [])), tool.get("version")))
        identity = component.get("repository", {"forge": {"name": ""}, "path": ""})
        if (not isinstance(identity, dict) or not isinstance(identity.get("forge"), dict)
                or not isinstance(identity["forge"].get("name"), str)
                or not isinstance(identity.get("path"), str)):
            raise ValueError("invalid Component repository")
        bindings.append(toolkit.ComponentBinding(
            repository=toolkit.Repository(toolkit.Forge(identity["forge"]["name"]), identity["path"]),
            name=component["name"], root=path, language=language, package_tools=tuple(package_tools)))
    return toolkit.Layout(repository=None, components=tuple(bindings))


def decode_impact(data: dict, repo: str, input_kind: str) -> ImpactReport:
    """Validate the external wire contract without deciding test execution policy."""
    if not isinstance(data, dict) or data.get("schemaVersion") != 3:
        raise ImpactProtocolError("unsupported repocli schema (requires 3; install repocli >= 0.38.0)")
    diagnostics = data.get("diagnostics")
    if (not isinstance(data.get("complete"), bool)
            or data.get("scope") not in ("focused", "partial")
            or not isinstance(diagnostics, list)
            or any(not isinstance(d, dict) for d in diagnostics)):
        raise ValueError("invalid analysis status")
    if Path(data.get("checkout", "")).resolve() != Path(repo).resolve():
        raise ValueError("analysis target mismatch")
    snapshot = data.get("snapshot", "")
    if not isinstance(snapshot, str) or len(snapshot) != 71 or not snapshot.startswith("sha256:"):
        raise ValueError("missing snapshot identity")
    if data.get("input") != input_kind:
        raise ValueError("analysis input mismatch")
    impacts = data.get("components")
    if not isinstance(impacts, list) or any(not isinstance(item, dict) for item in impacts):
        raise ValueError("invalid ComponentImpact list")
    seen = set()
    for item in impacts:
        _paths([item.get("root")])
        if not isinstance(item.get("affected"), bool):
            raise ValueError("Component impact requires repocli >= 0.24.0")
        if (not isinstance(item.get("complete"), bool)
                or item.get("snapshot") not in ("before", "after")
                or not isinstance(item.get("component"), dict)
                or not isinstance(item["component"].get("name"), str)
                or not item["component"]["name"]
                or not isinstance(item.get("fallbackReasons", []), list)
                or any(not isinstance(reason, str) for reason in item.get("fallbackReasons", []))):
            raise ValueError("invalid ComponentImpact status or identity")
        if "tagCounts" not in item:
            raise ImpactProtocolError("missing required Component tagCounts (install repocli >= 0.38.0)")
        counts = item["tagCounts"]
        if (not isinstance(counts, dict)
                or any(not isinstance(tag, str) or not tag.strip()
                       or type(count) is not int or count < 0 for tag, count in counts.items())):
            raise ImpactProtocolError("invalid Component tagCounts")
        key = (item["root"], item["snapshot"])
        if key in seen:
            raise ValueError("duplicate ComponentImpact root and snapshot")
        seen.add(key)
    affected = data.get("affectedFiles")
    if not isinstance(affected, list) or any(not isinstance(item, dict) for item in affected):
        raise ValueError("affected file list missing or invalid")
    return ImpactReport(data["complete"], data["scope"], tuple(diagnostics), snapshot,
                      tuple(impacts), _paths([item.get("path") for item in affected]),
                      _paths(data.get("testFiles")), _impact_layout(impacts, repo))

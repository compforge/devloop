"""Bounded repocli protocol adapter. Repository facts are owned by repocli."""
from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path, PurePosixPath
import subprocess


class InspectionError(ValueError):
    """Unavailable organization must not become an empty or fabricated catalog."""


@dataclass(frozen=True)
class PackageTool:
    name: str
    version: str = ""
    evidence: tuple[str, ...] = ()


@dataclass(frozen=True)
class ComponentInfo:
    root: str
    name: str
    language: str | None
    package_tools: tuple[PackageTool, ...]


def read_report(repo: str, command: str, args: list[str]) -> dict:
    timeout = 5 if command == "inspect" else 30
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


def inspect(repo: str) -> tuple[ComponentInfo, ...]:
    try:
        data = read_report(repo, "inspect", [])
        if data.get("schemaVersion") != 1:
            raise ValueError("unsupported inspect schema (requires 1)")
        if data.get("input") != "working_tree" or not isinstance(data.get("checkout"), str) or Path(data["checkout"]).resolve() != Path(repo).resolve():
            raise ValueError("inspect target mismatch")
        if data.get("complete") is not True or data.get("diagnostics") != []:
            raise ValueError("repository inspection incomplete")
        components = data.get("components")
        if not isinstance(components, list):
            raise ValueError("inspect components missing")
        result = []
        roots, names = set(), set()
        for entry in components:
            if not isinstance(entry, dict):
                raise ValueError("invalid component entry")
            root, name, language = entry.get("root"), entry.get("name"), entry.get("language")
            if (not isinstance(root, str) or not root or "\\" in root or "\x00" in root
                    or PurePosixPath(root).is_absolute() or ".." in PurePosixPath(root).parts
                    or PurePosixPath(root).as_posix() != root or root in roots
                    or not isinstance(name, str) or not name or name in names
                    or language is not None and not isinstance(language, str)):
                raise ValueError("invalid component identity or root")
            target = (Path(repo) / root).resolve()
            if not target.is_relative_to(Path(repo).resolve()):
                raise ValueError("component root escapes checkout")
            raw_tools = entry.get("packageTools", [])
            if not isinstance(raw_tools, list):
                raise ValueError("invalid package tools")
            tools = []
            for tool in raw_tools:
                if (not isinstance(tool, dict) or not isinstance(tool.get("name"), str)
                        or not isinstance(tool.get("version", ""), str)
                        or not isinstance(tool.get("evidence", []), list)
                        or any(not isinstance(x, str) for x in tool.get("evidence", []))):
                    raise ValueError("invalid package tool evidence")
                tools.append(PackageTool(tool["name"], tool.get("version", ""), tuple(tool.get("evidence", []))))
            roots.add(root)
            names.add(name)
            result.append(ComponentInfo(root, name, language, tuple(tools)))
        return tuple(result)
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError) as exc:
        raise InspectionError(f"repocli inspect unavailable: {exc}; install repocli >= 0.11.0") from exc

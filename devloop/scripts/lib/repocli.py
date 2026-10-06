"""Native organization inspection and CLI-based snapshot/diff consumption."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import repocli as toolkit
from repocli import InspectReport, PackageTool as PackageTool, owner as owner


class InspectionError(ValueError):
    """Unavailable organization must not become an empty or fabricated catalog."""


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
            # Declarations may name absent directories. Resolve existing ancestors
            # too, so a symlink cannot send future validation outside the checkout.
            if not (root / binding.root).resolve().is_relative_to(root):
                raise ValueError("component root escapes checkout")
        return report
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise InspectionError(f"repository inspection unavailable: {exc}") from exc

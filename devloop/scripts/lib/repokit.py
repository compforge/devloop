"""Native repository facts and the Go CLI impact protocol boundary."""
from __future__ import annotations

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
    checks = args[args.index("--check") + 1].split(",") if "--check" in args else ("lint", "test")
    return toolkit.decode_validation_report(completed.stdout, checkout=repo, checks=checks)

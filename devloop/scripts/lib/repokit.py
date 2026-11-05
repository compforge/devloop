"""Native repository facts used by workflow policy."""
from __future__ import annotations

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

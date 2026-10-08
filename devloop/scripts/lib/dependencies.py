"""Development policy over repocli's checkout-local dependency operations."""
from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from repocli import inspect_dependencies, prepare_dependencies

_LOG = logging.getLogger(__name__)


def preparation_problem(path: str | Path) -> str | None:
    """Preserve user-managed installations; prepare missing/stale locked dependencies.

    repocli owns package tools, workspace roots, process budgets and installation receipts.
    devloop only decides whether the observations permit entering its validation workflow.
    """
    try:
        for environment in inspect_dependencies(path):
            # Existing unmanaged dependencies may enter the actual project checks. This
            # does not assert lockfile consistency or issue a dependency-ready receipt.
            if environment.status in {"ready", "present"}:
                continue
            # Absence and preparation capability are separate repocli facts. Without
            # a locked installer, project checks decide whether dependencies are needed.
            if environment.status == "missing" and not environment.command:
                _LOG.warning(
                    "Dependency preparation skipped for %s at %s: no supported locked "
                    "installer is available; project checks will determine validation results",
                    environment.manager, environment.root,
                )
                continue
            result = prepare_dependencies(environment)
            if result.status != "ready":
                detail = result.stderr.strip() or result.stdout.strip()
                return (f"{result.status}: {environment.manager} at {environment.root}: {result.reason}"
                        + (f"\n{detail[-4000:]}" if detail else ""))
    except (OSError, ValueError, subprocess.SubprocessError, InterruptedError) as error:
        return f"dependency observation/preparation failed: {error}"
    return None

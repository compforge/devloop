"""Reuse the latest successful check for exactly the same execution inputs.

Branch projections refer to this evidence; they never issue independent permissions.
Each check/Component owns one record, so concurrent Components never overwrite it.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import os
import time
from pathlib import Path

from domain.context.store import load_segment, save_segment
from lib import dependencies
from domain.validation_evidence import evidence_segment
from domain.lifecycle.base import HookResult


def _environment_identity() -> str:
    # Shell bookkeeping is not passed as a meaningful check input. Hash all other
    # environment values without persisting secrets or guessing project-specific knobs.
    values = {key: value for key, value in os.environ.items()
              if key not in {"_", "SHLVL", "PWD", "OLDPWD"}}
    return hashlib.sha256(json.dumps(sorted(values.items()), ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


@dataclass(frozen=True)
class CheckRun:
    repo: str
    component: str
    check: str
    fingerprint: str
    command: tuple[str, ...]
    scope: str
    files: tuple[str, ...] = ()
    environment: str = field(default_factory=_environment_identity)

    dependencies: tuple[tuple[str, str], ...] | None = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "dependencies", dependencies.reuse_inputs(Path(self.repo) / self.component))

    @property
    def segment(self) -> str:
        return evidence_segment(self.repo, self.component, self.check)

    def identity(self) -> dict:
        return {
            "version": 2,
            "checkout": str(Path(self.repo).resolve()),
            "component": self.component,
            "check": self.check,
            "fingerprint": self.fingerprint,
            "command": list(self.command),
            "scope": self.scope,
            "environment": self.environment,
            "files": list(self.files),
            "dependencies": [list(item) for item in self.dependencies] if self.dependencies is not None else None,
        }

    def reuse(self) -> HookResult | None:
        if not self.fingerprint or self.dependencies is None or not self.environment_matches():
            return None
        record = load_segment(self.repo, self.segment)
        if not record or record.get("identity") != self.identity():
            return None
        if record.get("status") != "passed" or not isinstance(record.get("checked_at"), (int, float)):
            return None
        return HookResult(
            self.check, ok=True, advisory=self.check == "test",
            summary=f"{self.component}: reused passed {self.check} ({self.scope}) — "
                    "identical contents, command, scope and managed environment",
        )

    def environment_matches(self) -> bool:
        return (self.environment == _environment_identity()
                and self.dependencies == dependencies.reuse_inputs(Path(self.repo) / self.component))

    def record(self, result: HookResult) -> HookResult:
        # Failed/skipped/unavailable checks never grant reuse. Writing their status also
        # invalidates an earlier success for this Component/check.
        if result.status == "passed" and not self.environment_matches():
            result = HookResult(self.check, ok=False, advisory=self.check == "test",
                                summary="dependency environment changed during validation; rerun checks")
        save_segment(self.repo, self.segment, {
            "identity": self.identity(),
            "status": result.status if self.fingerprint else "unavailable",
            "checked_at": time.time(),
        })
        return result

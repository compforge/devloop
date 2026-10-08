"""Reuse the latest successful check for exactly the same execution inputs.

This is execution evidence, separate from the full-Component stamps used by guards.
Each check/Component owns one record, so concurrent Components never overwrite it.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path

from domain.context.store import load_segment, save_segment
from domain.lifecycle.base import HookResult


def _environment_identity() -> str:
    # Shell bookkeeping is not passed as a meaningful check input. Hash all other
    # environment values without persisting secrets or guessing project-specific knobs.
    values = {key: value for key, value in os.environ.items()
              if key not in {"_", "SHLVL", "PWD", "OLDPWD"}}
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


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

    @property
    def segment(self) -> str:
        owner = f"{Path(self.repo).resolve()}\0{self.component}\0{self.check}"
        return "validation_results/" + hashlib.sha256(owner.encode()).hexdigest()

    def identity(self) -> dict:
        return {
            "version": 1,
            "checkout": str(Path(self.repo).resolve()),
            "component": self.component,
            "check": self.check,
            "fingerprint": self.fingerprint,
            "command": list(self.command),
            "scope": self.scope,
            "environment": self.environment,
            "files": list(self.files),
        }

    def reuse(self) -> HookResult | None:
        if not self.fingerprint:
            return None
        record = load_segment(self.repo, self.segment)
        if not record or record.get("identity") != self.identity():
            return None
        if record.get("status") != "passed":
            return None
        return HookResult(
            self.check, ok=True, advisory=self.check == "test",
            summary=f"{self.component}: reused passed {self.check} ({self.scope}) — "
                    "identical contents, command and scope; validation stamps unchanged",
        )

    def record(self, result: HookResult) -> HookResult:
        # Failed/skipped/unavailable checks never grant reuse. Writing their status also
        # invalidates an earlier success for this Component/check.
        save_segment(self.repo, self.segment, {
            "identity": self.identity(),
            "status": result.status if self.fingerprint else "unavailable",
        })
        return result

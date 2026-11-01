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

    snapshot: str = ""
    dependency_components: tuple[str, ...] = ()
    dependencies: tuple[tuple[str, str], ...] | None = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "dependencies", self.dependency_inputs())

    def dependency_inputs(self) -> tuple[tuple[str, str], ...] | None:
        witnesses: dict[str, str] = {}
        for component in self.dependency_components or (self.component,):
            inputs = dependencies.reuse_inputs(Path(self.repo) / component)
            if inputs is None:
                return None
            witnesses.update(inputs)
        return tuple(sorted(witnesses.items()))

    @property
    def segment(self) -> str:
        return evidence_segment(self.repo, self.component, self.check)

    def identity(self) -> dict:
        return {
            "version": 3,
            "checkout": str(Path(self.repo).resolve()),
            "component": self.component,
            "check": self.check,
            "fingerprint": self.fingerprint,
            "snapshot": self.snapshot or self.fingerprint,
            "dependency_components": list(self.dependency_components),
            "command": list(self.command),
            "scope": self.scope,
            "environment": self.environment,
            "files": list(self.files),
            "dependencies": [list(item) for item in self.dependencies] if self.dependencies is not None else None,
        }

    def reuse(self) -> HookResult | None:
        if not self.fingerprint or self.dependencies is None or not self.environment_matches():
            self.report_miss("input identity or managed environment unavailable")
            return None
        record = load_segment(self.repo, self.segment)
        if not record:
            self.report_miss("no previous check record")
            return None
        previous = dict(record.get("identity") or {})
        current = self.identity()
        # Reconcile content evidence to this freshly checked repository snapshot;
        # the actual execution timestamp and check input identity remain unchanged.
        previous.pop("snapshot", None)
        comparable = {key: value for key, value in current.items() if key != "snapshot"}
        if previous != comparable:
            changed = sorted(key for key in previous.keys() | comparable.keys()
                             if previous.get(key) != comparable.get(key))
            self.report_miss("changed " + ", ".join(changed))
            return None
        if record.get("status") != "passed" or not isinstance(record.get("checked_at"), (int, float)):
            self.report_miss("previous check did not pass")
            return None
        if record["identity"] != current:
            save_segment(self.repo, self.segment, {**record, "identity": current})
        return HookResult(
            self.check, ok=True, advisory=self.check == "test",
            summary=f"{self.component}: reused passed {self.check} ({self.scope}) — "
                    "identical contents, command, scope and managed environment",
        )

    def report_miss(self, reason: str) -> None:
        print(f"[validate] {self.check} {self.component}: reuse miss — {reason}; execute selected {self.scope} scope", flush=True)

    def environment_matches(self) -> bool:
        return (self.environment == _environment_identity()
                and self.dependencies == self.dependency_inputs())

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

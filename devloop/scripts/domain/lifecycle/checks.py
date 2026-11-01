"""Lifecycle check policies over one repocli validation round."""
from __future__ import annotations

from domain.validation import run_validation
from domain.lifecycle.base import HookResult


def lint(repo: str, *, paths: list[str] | None = None) -> HookResult:
    return run_validation(repo, names=("lint",), paths=paths).results[0]


def test(repo: str, *, paths: list[str] | None = None) -> HookResult:
    return run_validation(repo, names=("test",), paths=paths).results[0]

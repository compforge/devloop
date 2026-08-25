"""Shared task discovery for Claude monitors and Codex Scheduled tasks."""
from __future__ import annotations

import importlib
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TaskSpec:
    name: str
    module: str
    description: str
    interval_seconds: int


def discover() -> dict[str, TaskSpec]:
    """Load the plugin's canonical task catalog, keyed by stable task name."""
    payload = json.loads((Path(__file__).parent / "tasks.json").read_text(encoding="utf-8"))
    specs = [TaskSpec(**item) for item in payload]
    return {spec.name: spec for spec in specs}


def run(name: str, target: str) -> list[dict]:
    """Run one discovered task exactly once."""
    spec = discover()[name]
    task = importlib.import_module(spec.module)
    return task.run(target)

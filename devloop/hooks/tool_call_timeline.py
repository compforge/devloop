#!/usr/bin/env python3
"""Record raw Pre/PostToolUse events in each confidently attributable repo."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from domain import repo_layout  # noqa: E402
from domain.context import tool_calls  # noqa: E402
from hooks import hook_io  # noqa: E402
from hooks.core import engine  # noqa: E402
from hooks.core.domain import Command, FileChange  # noqa: E402


def handle(inp: hook_io.HookInput) -> None:
    timestamp = time.time()
    call_id = inp.raw.get("tool_use_id")
    if not isinstance(call_id, str):
        call_id = ""
    phase = "started" if inp.event == "PreToolUse" else "finished"
    for root in _repo_roots(inp):
        record = {
            "schema": tool_calls.SCHEMA,
            "kind": "tool_call",
            "phase": phase,
            "ts": timestamp,
            "call_id": call_id,
            "session_id": inp.session_id,
            "harness": "codex" if inp.is_codex else "claude",
            "tool": inp.tool_name,
        }
        if phase == "finished":
            record["outcome"] = (
                "failed" if inp.event == "PostToolUseFailure" else "succeeded"
            )
            started = tool_calls.started_at(root, call_id, now=timestamp)
            if started is not None:
                record["duration_ms"] = max(0, round((timestamp - started) * 1000))
        tool_calls.append(root, record, now=timestamp)


def _repo_roots(inp: hook_io.HookInput) -> tuple[str, ...]:
    anchors: list[Path] = []
    try:
        for target in engine.project(inp).targets:
            if isinstance(target, FileChange):
                anchors.append(_absolute(inp.cwd, target.path).parent)
            elif isinstance(target, Command) and target.working_dir.path is not None:
                anchors.append(target.working_dir.path)
    except Exception:
        pass

    for key in ("file_path", "notebook_path", "path"):
        value = inp.tool_input.get(key)
        if isinstance(value, str) and value.strip():
            path = _absolute(inp.cwd, value)
            anchors.append(path if path.is_dir() else path.parent)
    if not anchors:
        anchors.append(Path(inp.cwd or "."))

    roots: dict[str, None] = {}
    for anchor in anchors:
        root = repo_layout.find_git_root(anchor)
        if root:
            roots.setdefault(str(Path(root).resolve()), None)
    return tuple(roots)


def _absolute(cwd: str, path: str) -> Path:
    candidate = Path(path).expanduser()
    return candidate if candidate.is_absolute() else Path(cwd or ".") / candidate


if __name__ == "__main__":
    raise SystemExit(hook_io.observe(handle))

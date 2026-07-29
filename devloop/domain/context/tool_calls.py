"""Rolling repository-local timeline of raw harness tool calls.

The timeline is an interoperability fact for consumers such as reqloop. Devloop
records what happened; it deliberately does not classify tools as reads or writes.
"""
from __future__ import annotations

import fcntl
import json
import os
import time
from pathlib import Path

from . import store

SCHEMA = "devloop.tool-call/v1"
FILE_NAME = "tool-calls.jsonl"
WINDOW_SECONDS = 60 * 60
COMPACT_INTERVAL_SECONDS = 60


def append(root: str | Path, record: dict, *, now: float | None = None) -> None:
    """Append one event and opportunistically retain only the latest hour.

    Append and compaction share the same short-lived lock. Without that common
    lock an atomic replace could discard a line appended between read and rename.
    This is best-effort observability and must never affect the harness tool call.
    """
    try:
        timestamp = time.time() if now is None else now
        directory = store.state_dir(root)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / FILE_NAME
        lock_path = directory / "tool-calls.lock"
        with open(lock_path, "a+b") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            if _compaction_due(lock_path, timestamp):
                _compact(path, timestamp - WINDOW_SECONDS)
                os.utime(lock_path, (timestamp, timestamp))
            with open(path, "a", encoding="utf-8") as stream:
                stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    except (OSError, ValueError, TypeError):
        pass


def started_at(
    root: str | Path,
    call_id: str,
    *,
    now: float | None = None,
) -> float | None:
    """Find a recent matching start so a terminal event can include duration."""
    if not call_id:
        return None
    try:
        timestamp = time.time() if now is None else now
        path = store.state_dir(root) / FILE_NAME
        rows = path.read_text(encoding="utf-8").splitlines()
        for line in reversed(rows):
            try:
                record = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            if not isinstance(record, dict):
                continue
            event_ts = record.get("ts")
            if not isinstance(event_ts, (int, float)):
                continue
            if event_ts < timestamp - WINDOW_SECONDS:
                break
            if (
                record.get("schema") == SCHEMA
                and record.get("phase") == "started"
                and record.get("call_id") == call_id
            ):
                return float(event_ts)
    except OSError:
        pass
    return None


def _compaction_due(lock_path: Path, now: float) -> bool:
    try:
        return now - lock_path.stat().st_mtime >= COMPACT_INTERVAL_SECONDS
    except OSError:
        return True


def _compact(path: Path, cutoff: float) -> None:
    if not path.exists():
        return
    retained: list[str] = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                record = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            if (
                isinstance(record, dict)
                and isinstance(record.get("ts"), (int, float))
                and record["ts"] >= cutoff
            ):
                retained.append(json.dumps(record, ensure_ascii=False))
        temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
        temporary.write_text(
            "".join(f"{line}\n" for line in retained),
            encoding="utf-8",
        )
        os.replace(temporary, path)
    except OSError:
        pass

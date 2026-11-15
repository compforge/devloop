"""Review feedback — Verdict joins and delivery fingerprints.

Findings carry a `ccr:fp` footer. Verdict comments carry `ccr:label` and an explicit
opaque target Comment ID. This relationship lives on the Forge and survives Home cleanup.
Older Verdicts without a target marker use the platform's `reply_to_id`; grouped replies
cannot recover an exact historical target beyond the parent the Forge reports.

Pure over a `list[Comment]` — the caller does the fetching. That keeps the forge round-trip at
the presentation or review workflow boundary and makes this testable without HTTP.

All PR comments are passed to CCR by the review workflow without this module filtering them.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Literal, cast

from domain.forge import Comment, CommentResolution

# Body conventions written by run_review (`ccr:fp=`) and the review skill (`ccr:label=`).
# Kept as loose scans, not anchored matches: both footers are embedded in prose/markdown
# (`<sub>ccr:fp=abc</sub>`, "ccr:label=wrong — 反证是 …").
_FP_RE = re.compile(r"ccr:fp=([A-Za-z0-9_-]+)")
_LABEL_RE = re.compile(r"ccr:label=([A-Za-z]+)")
_TARGET_RE = re.compile(r"<!--\s*ccr:target=([A-Za-z0-9_-]+)\s*-->")
_HISTORY_RE = re.compile(r"<!--\s*ccr:history=([A-Za-z0-9_-]+)\s*-->")

Verdict = Literal["important", "minor", "debatable", "wrong", "repeat"]

# The durable Verdict vocabulary. `ccr:label=` is only its Forge wire encoding; callers should
# use `verdict_reply()` rather than formatting the protocol themselves.
VERDICTS: tuple[Verdict, ...] = ("important", "minor", "debatable", "wrong", "repeat")
CONFIRMED_VERDICTS = frozenset({"important", "minor"})


@dataclass
class Finding:
    """A published finding comment joined with its verdict reply (if any)."""
    fp: str
    comment: Comment
    verdict: Verdict | None = None

    @property
    def pending(self) -> bool:
        return self.verdict is None


def parse_verdict(body: str) -> Verdict | None:
    """Parse the Verdict encoded in a reply; ordinary and malformed replies have none."""
    match = _LABEL_RE.search(body or "")
    if not match or match.group(1) not in VERDICTS:
        return None
    return cast(Verdict, match.group(1))


def verdict_reply(verdict: Verdict, reason: str, *, target_id: str) -> str:
    """Encode a Verdict for the Forge transport after validating its required rationale."""
    reason = reason.strip()
    if verdict not in VERDICTS:
        raise ValueError(f"unknown review verdict: {verdict}")
    if not reason:
        raise ValueError("a review verdict requires a reason")
    if not target_id:
        raise ValueError("a review verdict requires a target Comment ID")
    encoded = base64.urlsafe_b64encode(target_id.encode()).decode().rstrip("=")
    return f"ccr:label={verdict} — {reason}\n<!-- ccr:target={encoded} -->"


def _verdicts(comments: list[Comment]) -> dict[str, tuple[Verdict, str]]:
    """Join exact targets, falling back to structural parents for legacy Verdicts.

    +spec=An explicit Verdict target wins over a grouped reply's structural parent.
    +link=component://docs/code-review.md
    """
    ids = {comment.id for comment in comments}
    result: dict[str, tuple[Verdict, str]] = {}
    for comment in comments:
        verdict = parse_verdict(comment.body)
        if verdict is None:
            continue
        target = comment.reply_to_id
        if "ccr:target=" in comment.body:
            markers = _TARGET_RE.findall(comment.body)
            if len(markers) != 1:
                continue
            try:
                target = base64.urlsafe_b64decode(markers[0] + "=" * (-len(markers[0]) % 4)).decode()
            except (ValueError, UnicodeDecodeError):
                continue
        if target in ids and target != comment.id:
            result.setdefault(target, (verdict, comment.body))
    return result


def history_marker(*, key: str, msg: str, sha: str = "", fp: str = "") -> str:
    """Encode one finding as forge-resident machine metadata.

    The visible body remains the human review comment. This hidden marker preserves the
    exact unit key and untruncated message even when a provider loses symbol metadata or a
    finding has to fall back into a summary note.
    """
    payload = json.dumps(
        {"key": key, "msg": msg, "sha": sha, "fp": fp},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    return "<!-- ccr:history=" + base64.urlsafe_b64encode(payload).decode().rstrip("=") + " -->"


def _decode_history_marker(raw: str) -> dict | None:
    try:
        padded = raw + "=" * (-len(raw) % 4)
        value = json.loads(base64.urlsafe_b64decode(padded).decode())
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(value, dict) or not value.get("key") or not value.get("msg"):
        return None
    return value


def suppress_delivery_fingerprints(comments: list[Comment]) -> set[str]:
    """Fingerprints whose existing Forge comment should not be delivered again.

    Unresolved/unsupported comments already give the finding a durable place on the MR.
    A `wrong` or `repeat` verdict also suppresses the same stable finding after resolution.
    Another resolved comment may be delivered again if the issue genuinely reappears later.
    """
    suppressed = set()
    verdicts = _verdicts(comments)
    for comment in comments:
        if not (comment.body or "").startswith("🤖 **devloop code-review**"):
            continue
        verdict, _ = verdicts.get(comment.id, (None, ""))
        if comment.resolution == CommentResolution.RESOLVED and verdict not in {"wrong", "repeat"}:
            continue
        fps = {
            str(value.get("fp"))
            for raw in _HISTORY_RE.findall(comment.body or "")
            if (value := _decode_history_marker(raw)) is not None and value.get("fp")
        }
        fps.update(_FP_RE.findall(comment.body or ""))
        suppressed.update(fps)
    return suppressed


def findings(comments: list[Comment]) -> list[Finding]:
    """Join individual finding comments with Verdicts; summary list text is not a finding.

    The publisher gives individual findings a subscript fingerprint footer. Older anchored
    findings may carry only the fingerprint. Neither condition depends on platform handles.
    """
    found = []
    verdicts = _verdicts(comments)
    for c in comments:
        if not c.anchor and not re.search(r"<sub>ccr:fp=[A-Za-z0-9_-]+</sub>", c.body):
            continue
        m = _FP_RE.search(c.body or "")
        if not m:
            continue
        verdict, _ = verdicts.get(c.id, (None, ""))
        found.append(Finding(fp=m.group(1), comment=c, verdict=verdict))
    return found


def pending(comments: list[Comment]) -> list[Finding]:
    """Published findings still awaiting a verdict — the nudge's source of truth."""
    return [f for f in findings(comments) if f.pending]


def pending_key(found: list[Finding]) -> str:
    """Identity of a pending SET, for Board event delivery decay.

    Hashes each finding's stable fp PLUS its published comment id. The fp identifies the issue,
    while the id identifies this review round's occurrence: if the same issue is published again
    after an earlier round was labeled, it is new work and must reopen the nudge. Sorted so comment
    order (two forge surfaces, interleaved by time) can't churn the key and reset the decay.
    """
    identities = sorted(f"{f.fp}:{f.comment.id}" for f in found)
    return hashlib.sha256("\n".join(identities).encode()).hexdigest()[:12] if identities else ""

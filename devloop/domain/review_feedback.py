"""Review feedback — verdict joins and continuous-review history.

The durable relationship, entirely on the forge: `run_review` publishes each finding as a
replyable comment carrying a `ccr:fp=<fp>` footer; an agent/human later replies to that comment
with `ccr:label=<verdict>`. This module joins the two back together over `Forge.comments()`.

Nothing here is persisted as a source of truth, on purpose. The join key (`fp`) travels inside
the comment bodies, so the pair is recoverable from the API alone — from any machine, any
worktree, any session, including ones that never saw the review run. A local fp→comment-id
table would only be a staler copy of what `comments()` already returns, and would silently
break the join when it's lost. Callers may CACHE a derived count (see `context.prstate`), which
is safe precisely because it can always be re-derived here.

Pure over a `list[Comment]` — the caller does the fetching. That keeps the forge round-trip at
the poll boundary and makes this testable without HTTP.

The same boundary serves re-review: finding comments carry hidden `ccr:history` metadata, and
`history_feed()` projects the current Forge comments into ccr's one-shot input. The generated
file is transport only; no local JSON becomes a second source of truth.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass

from domain.forge import Comment, CommentResolution

# Body conventions written by run_review (`ccr:fp=`) and the label-review skill (`ccr:label=`).
# Kept as loose scans, not anchored matches: both footers are embedded in prose/markdown
# (`<sub>ccr:fp=abc</sub>`, "ccr:label=wrong — 反证是 …").
_FP_RE = re.compile(r"ccr:fp=([A-Za-z0-9_-]+)")
_LABEL_RE = re.compile(r"ccr:label=([A-Za-z]+)")
_HISTORY_RE = re.compile(r"<!--\s*ccr:history=([A-Za-z0-9_-]+)\s*-->")
_FOOTER_RE = re.compile(r"\n*\s*<sub>[^<]*ccr:fp=.*?</sub>\s*$", re.DOTALL)

# The verdict vocabulary the skill writes. Anything else is treated as unlabeled rather than
# accepted: a typo'd verdict must show up as still-pending, not silently pollute ground truth.
VERDICTS = ("important", "minor", "debatable", "wrong", "repeat")


@dataclass
class Finding:
    """A published finding comment joined with its verdict reply (if any)."""
    fp: str
    comment: Comment
    label: str = ""            # "" = pending a verdict

    @property
    def pending(self) -> bool:
        return not self.label


def label_verdict(body: str) -> str:
    """Return a recognized `ccr:label` verdict, or "" for ordinary/invalid replies."""
    match = _LABEL_RE.search(body or "")
    return match.group(1) if match and match.group(1) in VERDICTS else ""


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


def _legacy_message(body: str) -> str:
    """Recover the original text from pre-marker devloop finding comments."""
    text = _FOOTER_RE.sub("", body or "").strip()
    if text.startswith("🤖 **devloop code-review**") and "\n\n" in text:
        text = text.split("\n\n", 1)[1].strip()
    return text


def _history_message(msg: str, comment: Comment, label: str, reply_body: str) -> str:
    parts = [msg.strip()]
    if label == "wrong":
        parts.append(
            "Previous verdict: wrong (false positive). Do not repeat it unless the current "
            "revision provides new concrete evidence."
        )
    elif label == "repeat":
        parts.append(
            "Previous verdict: repeat (already delivered in an earlier MR comment). "
            "Do not deliver it again."
        )
    elif label:
        parts.append(f"Previous verdict: {label}.")
    if reply_body:
        parts.append("Reviewer feedback: " + reply_body.strip())
    if comment.resolution == CommentResolution.RESOLVED:
        parts.append("Forge thread: resolved; verify the current revision before re-raising.")
    return "\n".join(parts)


def history_feed(comments: list[Comment]) -> dict[str, list[dict[str, str]]]:
    """Project current Forge comments into ccr's transient history input.

    Forge is the durable source. New comments carry one or more `ccr:history` markers;
    old replyable devloop comments fall back to their diff path and visible body. Repeated
    fingerprints collapse to the latest occurrence so re-review does not amplify its own
    prior duplicates.
    """
    entries: dict[str, tuple[str, dict[str, str]]] = {}
    for comment in comments:
        # PR comments are user-controlled prompt input. devloop only ingests its own
        # publisher protocol; other review bots remain ordinary MR context.
        if not (comment.body or "").startswith("🤖 **devloop code-review**"):
            continue
        reply = next(
            ((label_verdict(r.body), r.body) for r in comment.replies if label_verdict(r.body)),
            ("", ""),
        )
        label, reply_body = reply
        decoded = [
            value
            for raw in _HISTORY_RE.findall(comment.body or "")
            if (value := _decode_history_marker(raw)) is not None
        ]
        if not decoded and comment.replyable and _FP_RE.search(comment.body or "") and comment.path:
            decoded = [{
                "key": comment.path,
                "msg": _legacy_message(comment.body),
                "sha": "",
                "fp": _FP_RE.search(comment.body).group(1),
            }]
        for value in decoded:
            fp = str(value.get("fp") or "")
            identity = fp or f"{value['key']}\0{value['msg']}"
            item = {
                "msg": _history_message(str(value["msg"]), comment, label, reply_body),
            }
            if value.get("sha"):
                item["sha"] = str(value["sha"])
            # Adapters return comments chronologically; overwrite makes the latest review
            # occurrence authoritative while retaining its human verdict.
            entries[identity] = (str(value["key"]), item)

    feed: dict[str, list[dict[str, str]]] = {}
    for key, item in entries.values():
        feed.setdefault(key, []).append(item)
    return feed


def suppress_delivery_fingerprints(comments: list[Comment]) -> set[str]:
    """Fingerprints whose existing Forge thread should not be delivered again.

    Unresolved/unsupported threads already give the finding a durable place on the MR.
    A `wrong` or `repeat` verdict also suppresses the same stable finding after resolution.
    Another resolved thread may be delivered again if the issue genuinely reappears later.
    """
    suppressed = set()
    for comment in comments:
        if not (comment.body or "").startswith("🤖 **devloop code-review**"):
            continue
        label = next(
            (verdict for reply in comment.replies
             if (verdict := label_verdict(reply.body))),
            "",
        )
        if comment.resolution == CommentResolution.RESOLVED and label not in {"wrong", "repeat"}:
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
    """Published findings on a PR/MR, each with its first valid verdict reply.

    A published finding is a replyable comment carrying a `ccr:fp=`. Replyability excludes the
    review summary note, which may list `ccr:fp=` once per fallback finding. The summary has
    no reply target, so nothing in it can be labeled.
    """
    found = []
    for c in comments:
        if not c.replyable:
            continue
        m = _FP_RE.search(c.body or "")
        if not m:
            continue
        label = next((verdict for reply in c.replies
                      if (verdict := label_verdict(reply.body))), "")
        found.append(Finding(fp=m.group(1), comment=c, label=label))
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
    identities = sorted(f"{f.fp}:{f.comment.id or f.comment.reply_ref}" for f in found)
    return hashlib.sha256("\n".join(identities).encode()).hexdigest()[:12] if identities else ""

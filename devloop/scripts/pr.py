#!/usr/bin/env python3
"""Review discussion reads and replies through the native RepoKit toolkit.

PR creation, status and updates are direct repocli commands documented by skills.
"""
from __future__ import annotations

import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))

from domain.forge import (  # noqa: E402
    ForgeError,
    parse_pr_number,
    pr_label,
)
from lib import cli  # noqa: E402
from lib.config import pull_request_target
from lib.forge import forge_client



def _forge_or_exit(ns, prog):
    """Resolve the repo target → a forge, or exit. `None` (no Forge origin) is a
    clean exit(0): the same not-an-error treatment the per-verb scripts had — devloop runs in
    repos with no forge and callers shouldn't see a failure for asking."""
    resolved, _ = cli.resolve_repo_or_exit(ns, prog)
    ns.repo_root = resolved.git_root
    try:
        forge = forge_client(resolved.git_root)
    except ForgeError as error:
        print(f"{prog}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    if forge is None:
        print(f"{prog}: no Forge origin", file=sys.stderr)
        raise SystemExit(0)
    target = pull_request_target(resolved.git_root)
    return forge.for_repository(target) if target else forge




def _number_or_exit(raw, prog):
    n = parse_pr_number(raw)
    if n is None:
        print(f"{prog}: cannot parse PR/MR number from {raw!r}", file=sys.stderr)
        raise SystemExit(1)
    return n




def cmd_comment(ns) -> int:
    """Read a complete top-level comment and its replies without changing review state."""
    forge = _forge_or_exit(ns, "pr comment")
    number = _number_or_exit(ns.number, "pr comment")
    try:
        target = next((c for c in forge.comments(number) if c.id == ns.comment_id), None)
    except ForgeError as exc:
        print(f"pr comment: {exc}", file=sys.stderr)
        return 1
    if target is None:
        print(f"pr comment: no comment {ns.comment_id} on "
              f"{pr_label(forge.provider, number)}", file=sys.stderr)
        return 1

    print(f"{pr_label(forge.provider, number)} comment {target.id} by {target.author}")
    print(f"Thread resolution (Forge): {target.resolution.value}")
    if target.path:
        location = target.path
        if target.line is not None:
            location += f":{target.line}"
        print(f"Location: {location}")
    # spec: Preserve full Markdown and all replies, including content beyond the summary limits.
    print()
    print(target.body)
    print(f"\nReplies ({len(target.replies)}):")
    for reply in target.replies:
        print(f"\nReply {reply.id or '?'} by {reply.author}")
        print(reply.body)
    return 0








def cmd_reply(ns) -> int:
    """Reply in a comment's thread without applying review-domain side effects."""
    forge = _forge_or_exit(ns, "pr reply")
    number = _number_or_exit(ns.number, "pr reply")
    try:
        target = next((c for c in forge.comments(number) if c.id == ns.comment_id), None)
        if target is None:
            print(f"pr reply: no comment {ns.comment_id} on "
                  f"{pr_label(forge.provider, number)}", file=sys.stderr)
            return 1
        forge.reply(number, target, ns.body)
    except (ForgeError, ValueError) as e:
        print(f"pr reply: {e}", file=sys.stderr)
        return 1
    print(f"replied to {ns.comment_id} on {pr_label(forge.provider, number)}")
    return 0


def main(argv: list[str]) -> int:
    ap = cli.ArgParser(
        prog="pr",
        description="Review discussion reads and replies through the native toolkit.",
    )
    sub = ap.add_subparsers(dest="verb", required=True)

    p_comment = sub.add_parser("comment", help="read a full comment and its replies")
    p_comment.add_argument("number", metavar="number|url")
    p_comment.add_argument("comment_id", metavar="comment-id",
                           help="top-level id from `review findings`")
    cli.add_repo_arg(p_comment)
    p_comment.set_defaults(fn=cmd_comment)

    p_reply = sub.add_parser("reply", help="reply in a comment's thread")
    p_reply.add_argument("number", metavar="number|url")
    p_reply.add_argument("comment_id", metavar="comment-id", help="from `review findings`")
    p_reply.add_argument("body")
    cli.add_repo_arg(p_reply)
    p_reply.set_defaults(fn=cmd_reply)

    ns = ap.parse_args(argv)
    return ns.fn(ns)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

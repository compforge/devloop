#!/usr/bin/env python3
"""review — provider-neutral operations for devloop's automated review lifecycle.

ReviewRun production, Finding inspection, Verdict persistence, and thread resolution share one
domain surface. Generic PR/MR operations remain in `pr.py`; callers never format `ccr:label=`
or couple a Verdict to discussion resolution themselves.
"""
from __future__ import annotations

import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS.parent))
sys.path.insert(0, str(_SCRIPTS))

from domain import review_feedback  # noqa: E402
from domain.context import store  # noqa: E402
from domain.forge import CommentResolution, ForgeError, parse_pr_number, pr_label  # noqa: E402
from lib import cli, git_state  # noqa: E402
from lib.forge import forge_for_repo  # noqa: E402


def _forge_or_exit(ns, prog):
    resolved, _ = cli.resolve_repo_or_exit(ns, prog)
    forge = forge_for_repo(resolved.git_root)
    if forge is None:
        print(f"{prog}: no token or unsupported remote", file=sys.stderr)
        raise SystemExit(0)
    return forge


def _number_or_exit(raw: str, prog: str) -> int:
    number = parse_pr_number(raw)
    if number is None:
        print(f"{prog}: cannot parse PR/MR number from {raw!r}", file=sys.stderr)
        raise SystemExit(1)
    return number


def _findings(forge, number: int, prog: str) -> list[review_feedback.Finding] | None:
    try:
        return review_feedback.findings(forge.comments(number))
    except ForgeError as exc:
        print(f"{prog}: {exc}", file=sys.stderr)
        return None


def _finding_by_id(found: list[review_feedback.Finding], finding_id: str):
    return next((finding for finding in found if finding.comment.id == finding_id), None)


def cmd_status(ns) -> int:
    resolved, _ = cli.resolve_repo_or_exit(ns, "review status")
    repo = resolved.git_root
    branch = git_state.get_current_branch(repo)
    result = store.load_segment(repo, store.branch_segment(branch, "review")) or {}
    if not result:
        print(f"review status: no review run for {branch or 'detached HEAD'}")
        return 0
    status = result.get("status") or "unknown"
    sha = str(result.get("reviewed_sha") or "")[:9] or "?"
    count = int(result.get("count") or 0)
    failed = int(result.get("failed") or 0)
    print(
        f"review status: {status} on {sha} · {count} finding(s)"
        f" · {failed} file(s) failed"
    )
    if message := str(result.get("message") or "").strip():
        print(f"  {message}")
    return 0


def cmd_run(ns) -> int:
    # Keep the long-running implementation in its existing adapter. This command is the explicit
    # user-facing route; lifecycle hooks normally launch the same adapter in the background.
    from run_review import main as run_review_main

    argv: list[str] = []
    if repo := cli.repo_target(ns):
        argv.extend(("--repo", repo))
    if ns.background:
        argv.extend(("--background", ns.background))
    return run_review_main(argv)


def cmd_findings(ns) -> int:
    forge = _forge_or_exit(ns, "review findings")
    number = _number_or_exit(ns.number, "review findings")
    found = _findings(forge, number, "review findings")
    if found is None:
        return 1
    if ns.pending:
        found = [finding for finding in found if finding.pending]
    if not found:
        print("no published findings" + (" pending a verdict" if ns.pending else ""))
        return 0
    for finding in found:
        comment = finding.comment
        location = comment.path + (f":{comment.line}" if comment.line else "")
        print(
            f"{comment.id}  [{finding.verdict or 'PENDING'}]  "
            f"{location or '?'}  ccr:fp={finding.fp}"
        )
        body = (comment.body or "").strip().replace("\n", " ")
        print(f"    {body[:200]}")
    return 0


def cmd_label(ns) -> int:
    reason = ns.reason.strip()
    if not reason:
        print("review label: --reason cannot be empty", file=sys.stderr)
        return 1
    forge = _forge_or_exit(ns, "review label")
    number = _number_or_exit(ns.number, "review label")
    found = _findings(forge, number, "review label")
    if found is None:
        return 1
    finding = _finding_by_id(found, ns.finding_id)
    if finding is None:
        print(
            f"review label: no published finding {ns.finding_id} on "
            f"{pr_label(forge.provider, number)}",
            file=sys.stderr,
        )
        return 1
    if finding.verdict:
        print(
            f"review label: finding {ns.finding_id} already has verdict {finding.verdict}",
            file=sys.stderr,
        )
        return 1
    body = review_feedback.verdict_reply(ns.verdict, reason)
    try:
        forge.reply(number, finding.comment, body)
    except ForgeError as exc:
        print(f"review label: {exc}", file=sys.stderr)
        return 1
    print(
        f"labeled finding {ns.finding_id} as {ns.verdict} on "
        f"{pr_label(forge.provider, number)}; discussion left unchanged"
    )
    return 0


def cmd_resolve(ns) -> int:
    forge = _forge_or_exit(ns, "review resolve")
    number = _number_or_exit(ns.number, "review resolve")
    found = _findings(forge, number, "review resolve")
    if found is None:
        return 1
    finding = _finding_by_id(found, ns.finding_id)
    if finding is None:
        print(
            f"review resolve: no published finding {ns.finding_id} on "
            f"{pr_label(forge.provider, number)}",
            file=sys.stderr,
        )
        return 1
    if finding.pending:
        print("review resolve: record a verdict before resolving the finding", file=sys.stderr)
        return 1
    if finding.verdict in review_feedback.CONFIRMED_VERDICTS and not ns.fixed:
        print(
            "review resolve: valid findings require --fixed after the fix is published",
            file=sys.stderr,
        )
        return 1
    comment = finding.comment
    if comment.resolution is CommentResolution.RESOLVED:
        print(f"finding {ns.finding_id} is already resolved")
        return 0
    if not comment.resolve_ref:
        print("review resolve: this Forge comment is not resolvable", file=sys.stderr)
        return 1
    try:
        forge.resolve_comment(number, comment)
    except ForgeError as exc:
        print(f"review resolve: {exc}", file=sys.stderr)
        return 1
    print(f"resolved finding {ns.finding_id} on {pr_label(forge.provider, number)}")
    return 0


def cmd_missed(ns) -> int:
    forge = _forge_or_exit(ns, "review missed")
    number = _number_or_exit(ns.number, "review missed")
    reason = ns.reason.strip()
    if not reason:
        print("review missed: --reason cannot be empty", file=sys.stderr)
        return 1
    try:
        forge.comment(
            number,
            f"ccr:missed — {reason}",
            replyable=True,
            path=ns.path,
            line=ns.line,
        )
    except ForgeError as exc:
        print(f"review missed: {exc}", file=sys.stderr)
        return 1
    print(f"reported missed finding on {pr_label(forge.provider, number)} at {ns.path}")
    return 0


def main(argv: list[str]) -> int:
    parser = cli.ArgParser(
        prog="review",
        description="Manage devloop ReviewRuns, Findings, Verdicts, and thread handling.",
    )
    sub = parser.add_subparsers(dest="verb", required=True)

    status = sub.add_parser("status", help="show the current branch's latest ReviewRun")
    cli.add_repo_arg(status)
    status.set_defaults(fn=cmd_status)

    run = sub.add_parser("run", help="run the configured review engine now")
    run.add_argument("--background", "-b", help="optional requirement/business context")
    cli.add_repo_arg(run)
    run.set_defaults(fn=cmd_run)

    findings = sub.add_parser("findings", help="list published Findings and Verdicts")
    findings.add_argument("number", metavar="number|url")
    findings.add_argument("--pending", action="store_true", help="only Findings without a Verdict")
    cli.add_repo_arg(findings)
    findings.set_defaults(fn=cmd_findings)

    label = sub.add_parser("label", help="record a Finding Verdict without resolving its thread")
    label.add_argument("number", metavar="number|url")
    label.add_argument("finding_id", metavar="finding-id", help="from `review findings`")
    label.add_argument("verdict", choices=review_feedback.VERDICTS)
    label.add_argument("--reason", required=True)
    cli.add_repo_arg(label)
    label.set_defaults(fn=cmd_label)

    resolve = sub.add_parser("resolve", help="resolve a handled Finding thread")
    resolve.add_argument("number", metavar="number|url")
    resolve.add_argument("finding_id", metavar="finding-id", help="from `review findings`")
    resolve.add_argument(
        "--fixed",
        action="store_true",
        help="confirm an important/minor Finding's fix is published",
    )
    cli.add_repo_arg(resolve)
    resolve.set_defaults(fn=cmd_resolve)

    missed = sub.add_parser("missed", help="publish a review issue the engine missed")
    missed.add_argument("number", metavar="number|url")
    missed.add_argument("--path", required=True)
    missed.add_argument("--line", type=int)
    missed.add_argument("--reason", required=True)
    cli.add_repo_arg(missed)
    missed.set_defaults(fn=cmd_missed)

    ns = parser.parse_args(argv)
    return ns.fn(ns)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

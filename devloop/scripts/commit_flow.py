#!/usr/bin/env python3
"""Managed commit/push transactions; the AI invokes PR and validation CLI commands.

+spec=`This workflow does not create/update PRs or execute project validation.`
+link=`component://docs/repository.md`

Branch protection, checkout ownership and exact staging selection remain live checks.
Fresh branches use an explicit base, and pushes reject unintended foreign commits.
"""
from __future__ import annotations
from repokit import cli as repokit_cli
from domain import git_policy

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from domain import branch as branch_domain, lifecycle, repo as repo_model, commit as commit_domain  # noqa: E402
from domain.context import RepoContext, gate, record_active_repo, store
from domain.forge import ForgeError, PullRequest, pr_label  # noqa: E402
import command as cli
from repokit.git import state as git_state


class SmartError(Exception):
    pass


# ── phase dataflow ──────────────────────────────────────────────────────────────
# main() = resolve_intent → prepare_branch → stage_and_commit → publish.
# Each phase is a function of (intent, plan) + its predecessor's result — no phase
# re-reads argv/cwd/git defaults, and no cross-phase mutable locals (the old
# `current = ns.branch` style). New flow steps (amend-MR…) slot in
# as new phases instead of growing main().


@dataclass(frozen=True)
class GitIntent:
    """One run's full intent, resolved ONCE from argv + state.

    `explicit_base` is kept apart from `base`: an explicit --base opts into stacking
    and disables the foreign-commit guard; the default origin/<target> base enables it.
    """
    mode: str
    message: str
    requested_branch: str | None
    target: str
    base: str
    explicit_base: bool
    files: list[str]
    repo: str
    source: str       # repo resolution self-narration, goes into the PLAN banner
    invoke_cwd: str


@dataclass(frozen=True)
class BranchResult:
    branch: str   # the branch this run commits on, after positioning
    cut: bool     # freshly cut this run → foreign-commit guard applies
    # Verified open PR from the gate, retained for user-facing branch context.
    active_pr: PullRequest | None = None


@dataclass(frozen=True)
class StageResult:
    committed: bool
    commit: str = ""


def decide_branch(
    current: str | None,
    requested: str | None,
    *,
    protected: bool,
    stale: bool,
    base: str,
) -> tuple[str, str | None]:
    """Decide how to position the working branch — from explicit intent, NOT from whichever
    branch HEAD happens to sit on.

    `--branch` always means "fresh branch off `base`" (origin/<target> by default), so the
    outcome never depends on a prior gcampr having left us on an unrelated open/unmerged feature
    branch — the footgun where the new MR silently inherits that branch's commits. `--base` opts
    into intentional stacking. No `--branch` continues the current branch.

      ("cut", base)      → cut `requested` off `base`
      ("continue", None) → commit onto the current branch (continue its MR)
      ("error", why)     → refuse (current is protected/stale and no --branch given); caller raises
    """
    if requested and requested != current:
        return ("cut", base)
    if protected or stale:
        return ("error", "protected branch" if protected else "current branch's MR is merged/closed")
    return ("continue", None)


def resolve_intent(ns: argparse.Namespace, invoke_cwd: str) -> GitIntent:
    """Phase 1: argv + state → one immutable intent.

    cwd-independent: the session cwd routinely sits at the aggregate workspace root,
    so the repo is resolved from intent/state (Repo) instead of dying on
    "not a git repo". Raises SmartError when no repo can be resolved.
    """
    resolved, how = repo_model.resolve_repo_dir(ns.repo, invoke_cwd)
    if not resolved:
        raise SmartError(how)
    record_active_repo(resolved.git_root)
    target = ns.target or git_policy.local_default_target(resolved.git_root)
    files: list[str] = []
    for path in ns.file or []:
        if path not in files:
            files.append(path)
    return GitIntent(
        mode=ns.mode,
        message=ns.message,
        requested_branch=ns.branch,
        target=target,
        base=ns.base or f"origin/{target}",
        explicit_base=bool(ns.base),
        files=files,
        repo=resolved.git_root,
        source=how,
        invoke_cwd=invoke_cwd,
    )


def refusal_detail(gv: gate.GateView, fallback: str) -> str:
    """Enrich a refuse-to-continue reason with the live-polled PR evidence the gate already holds.

    The push gate queries repocli before deciding, so when it
    refuses a stale branch it KNOWS the PR's number/state/sha — but the bare "current branch's MR
    is merged/closed" line dropped all of it. A caller that just created the MR then distrusts the
    verdict as a stale-context false-positive and re-queries the forge by hand to second-guess it.
    Quoting the evidence inline (e.g. "MR !129 merged, sha 541268f") makes the verdict self-proving:
    nothing to re-verify when it's right, self-evidently wrong when it isn't. The protected-branch
    case has no PR — fall back to the plain reason."""
    pr = gv.active_pr
    if pr is None or not pr.inactive:
        return fallback
    bits = [f"{pr_label(gv.provider, pr.number)} {pr.state}"]
    if pr.sha:
        bits.append(f"sha {pr.sha[:9]}")
    if pr.updated_at:
        bits.append(f"updated {pr.updated_at}")
    detail = ", ".join(bits)
    if pr.web_url:
        detail += f" — {pr.web_url}"
    return detail


def prepare_branch(intent: GitIntent, gv: gate.GateView, plan: list[str]) -> BranchResult:
    """Phase 2: position the working branch — intent-driven, independent of where HEAD sits
    (see decide_branch for the cut/continue/error policy). Decides on gate truth (LIVE branch +
    SHA-validated PR state), never the cached RepoContext."""
    action, detail = decide_branch(
        gv.branch, intent.requested_branch, protected=gv.protected(), stale=gv.inactive(), base=intent.base,
    )
    if action == "error":
        raise SmartError(
            f"on '{gv.branch}' ({refusal_detail(gv, detail)}) — "
            f"pass --branch <name> to cut a fresh branch off {intent.base}."
        )
    if action == "cut":
        try:
            created = branch_domain.create(
                intent.repo,
                intent.requested_branch,
                intent.base,
                carry_changes=True,
            )
        except branch_domain.BranchError as exc:
            raise SmartError(str(exc)) from exc
        carried = " (carried over local changes)" if created.carried_changes else ""
        plan.append(f"cut new branch '{created.name}' off {created.base}{carried}")
        if created.stash_oid:
            plan.append(f"restored index and worktree; recovery stash retained: {created.stash_oid}")
        return BranchResult(branch=intent.requested_branch, cut=True)
    if gv.in_flight():
        # continuing onto a branch whose PR is still open — the loop's between-rounds state.
        pr = gv.active_pr
        label = pr_label(gv.provider, pr.number) if pr else "PR"
        plan.append(f"continuing in-flight {label} on '{gv.branch}'")
        return BranchResult(branch=gv.branch or "", cut=False, active_pr=pr)
    return BranchResult(branch=gv.branch or "", cut=False)


def stage_and_commit(intent: GitIntent, prepared: commit_domain.Prepared, plan: list[str]) -> StageResult:
    commit = commit_domain.create(prepared, intent.message, plan)
    return StageResult(bool(commit), commit)


def publish(intent: GitIntent, branch: BranchResult, staged: StageResult, plan: list[str]) -> None:
    """Phase 4: foreign-commit self-check, then push according to mode."""
    repo, target, current = intent.repo, intent.target, branch.branch

    # Foreign-commit guard: a branch cut fresh off origin/<target> (no --base stacking)
    # must carry ONLY this run's commit(s). More means it was cut off the wrong ref — the
    # classic footgun where a prior gcampr left HEAD on an unrelated feature branch — and the
    # MR would smuggle foreign commits into <target>. Catch at creation, not at merge.
    if branch.cut and not intent.explicit_base:
        commits = git_state.commits(repo, f"origin/{target}", current)
        ahead = len(commits)
        expected = 1 if staged.committed else 0
        if ahead > expected:
            subjects = "\n".join(f"{c.oid[:9]} {c.subject}" for c in commits)
            raise SmartError(
                f"'{current}' has {ahead} commit(s) vs origin/{target} but this run added {expected} — "
                f"it carries foreign commits (cut off a non-{target} base?). Re-cut off origin/{target}:\n{subjects}"
            )

    if intent.mode == "push":
        publish_branch(repo, current, plan, staged.commit)


def publish_branch(repo: str, branch: str, plan: list[str], expected_commit: str = "") -> None:
    """+spec=Publish one frozen commit through RepoCLI; only matching remote evidence confirms success, including after a lost push response.

    +link=component://devloop/docs/repository.md
    """
    commit = expected_commit or git_state.rev_parse(repo, f"refs/heads/{branch}")
    if not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", commit):
        raise SmartError("cannot freeze the source branch commit before publication")
    recovery = f"repocli git push --branch {branch!r} --commit {commit} --remote origin --check"
    try:
        result = repokit_cli.run(repo, ("git", "push"),
            ["--branch", branch, "--commit", commit, "--remote", "origin", "--set-upstream"], timeout=300)
        data = repokit_cli.push_result(result, repo, branch, commit, "origin")
        if result["outcome"] != "succeeded":
            error = result.get("error") or {}
            message = error.get("message") if isinstance(error, dict) else None
            raise SmartError(f"push {result['outcome']}: {message or 'remote publication not confirmed'}; inspect with {recovery}")
        if not data["confirmed"] or data.get("remoteCommit") != commit:
            raise ValueError("successful command lacks matching remote commit evidence")
        plan.append(f"confirmed origin/{branch} at {commit}")
        plan.extend(f"warning: {d['message']}" for d in data["diagnostics"])
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        raise SmartError(f"push result unavailable; inspect with {recovery} before retrying: {error}") from error

# The failure that bites gcampr callers most: a --message whose quotes/specials broke shell
# parsing, so its tail leaks as stray argv → "unrecognized arguments". Handed to cli.ArgParser
# as the extra hint so that error points at single-quoting / --message-file instead of
# dumping bare usage.
MESSAGE_HINT = (
    "hint: --message probably contained quotes/specials that broke shell parsing. "
    "Single-quote it, or pass --message-file <path> (or -F -, reading stdin) — no "
    "shell escaping needed (mirrors `git commit -F`)."
)


def _resolve_message(ns: argparse.Namespace, ap: argparse.ArgumentParser) -> str:
    """The commit message, from --message-file (a path, or '-' for stdin) or inline --message.
    File/stdin is the shell-escaping-free path for multi-line / quote-heavy messages — the
    industry norm (git's `-F`, gh's `--body-file`). Exactly one source is required."""
    if ns.message_file:
        try:
            raw = sys.stdin.read() if ns.message_file == "-" else Path(ns.message_file).read_text(encoding="utf-8")
        except OSError as e:
            ap.error(f"--message-file unreadable: {e}")
        msg = raw.strip("\n")
        if not msg.strip():
            ap.error("--message-file is empty")
        return msg
    if ns.message:
        return ns.message
    ap.error("a commit message is required: pass --message '<msg>' or --message-file <path>")


def _cleanup_commit_message_file(message_file: str | None, intent: GitIntent, plan: list[str]) -> None:
    """Remove only devloop's canonical one-shot message file after a successful flow.

    Other ``--message-file`` inputs belong to the caller and must never be consumed. The
    canonical scratch is kept on every failure path so the same message remains available
    for a retry; cleanup itself is best-effort and cannot turn a successful Git operation
    into a failure.
    """
    if not message_file or message_file == "-":
        return
    supplied = Path(message_file).expanduser()
    if not supplied.is_absolute():
        supplied = Path(intent.invoke_cwd) / supplied
    canonical = store.commit_message_file(intent.repo)
    try:
        same_file = supplied.resolve() == canonical.resolve()
    except (OSError, RuntimeError) as e:
        plan.append(f"commit message scratch retained (path check failed, non-fatal): {e}")
        return
    if not same_file:
        return
    try:
        canonical.unlink()
    except FileNotFoundError:
        return
    except OSError as e:
        plan.append(f"commit message scratch retained (cleanup failed, non-fatal): {e}")
    else:
        plan.append("removed one-shot .devloop/commit_msg")


def _build_parser() -> cli.ArgParser:
    """The arg schema — extracted so tests exercise the SAME parser main() runs (no drift).
    `--message` (inline) and `--message-file` are alternatives; exactly one is required, enforced
    in `_resolve_message` rather than by argparse, so the error can carry the quoting hint."""
    ap = cli.ArgParser(extra_hints=[MESSAGE_HINT])
    ap.add_argument("mode", choices=["commit", "push"])
    ap.add_argument("--message", "-m", default=None, help="inline commit message (single-quote it)")
    ap.add_argument(
        "--message-file", "-F", default=None,
        help="read the commit message from a file ('-' = stdin); for multi-line / quote-heavy "
             "messages, write it with the Write tool and pass the path — no shell escaping "
             "(mirrors `git commit -F` / `gh --body-file`)",
    )
    ap.add_argument("--branch", "-b", default=None, help="branch name to cut when on a protected/stale branch")
    ap.add_argument("--target", "-t", default=None)
    ap.add_argument(
        "--base",
        default=None,
        help="ref to cut --branch off (default origin/<target>); pass a feature branch for intentional stacking",
    )
    ap.add_argument(
        "--file", "-f", action="append", default=[], metavar="PATH",
        help="literal checkout-root-relative file/directory; repeat to select the complete commit scope",
    )
    cli.add_repo_arg(ap, positional=False)  # --repo/-r only; gcampr takes no positional repo
    return ap


def run_lifecycle_gate(intent: GitIntent, phase: str, paths: list[str], plan: list[str]) -> lifecycle.DispatchResult:
    """Run lifecycle actions; skill instructions own validation before publication."""
    res = lifecycle.dispatch(phase, intent.repo, paths=paths)
    if not res.results:
        return res

    def mark(r: lifecycle.HookResult) -> str:
        if r.status == "unavailable":
            return "⚠ unavailable"
        if r.ok:
            return "✓"
        return "⚠" if r.advisory else "✗"   # ⚠ = 软提示失败（不阻断）；✗ = 硬拦截失败

    plan.append(f"{phase}: " + ", ".join(f"{r.name} {mark(r)}" for r in res.results))
    for result in res.results:
        for guidance in result.guidance:
            plan.append(f"  - {result.name}: {guidance}")
    for r in res.advisory_failures:         # 软提示：本轮通报、不阻断
        plan.append(f"  ⚠ {r.name} failed (advisory, not blocking): {r.summary.splitlines()[0] if r.summary else ''}")
    if not res.proceed:
        detail = "\n".join(f"    [{r.name}] {r.summary}" for r in res.blocking_failures)
        step = "commit" if phase == "pre_commit" else "push"
        raise SmartError(f"{phase} gate failed — aborting before {step}:\n{detail}")
    return res


def launch_background_relays(specs: list[lifecycle.BackgroundSpec], repo: str, plan: list[str]) -> None:
    """把 signal hook 的后台下游（如 code-review）detach 起来——fire-and-forget，不阻塞、不靠 agent。

    `start_new_session=True` 让子进程脱离本进程组：commit_flow（及调用它的 Bash）退出后它仍
    存活，跑完写 `.devloop/review.json`，结果在下一轮经状态总线注入浮现（pull）。**须在 commit
    之后调用**——review 审的是新 HEAD。输出导向 `.devloop/review.log`（.devloop 已 gitignore）。
    """
    if not specs:
        return
    logp = store.tmp_dir(repo) / "review.log"
    logp.parent.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        try:
            with open(logp, "ab") as log:
                subprocess.Popen(spec.argv, cwd=repo, stdout=log, stderr=log, start_new_session=True)
            plan.append(f"{spec.name}: launched in background → .devloop/review.json (surfaces next turn)")
        except OSError as e:
            plan.append(f"{spec.name}: background launch failed (non-fatal): {e}")


def main(argv: list[str]) -> int:
    ap = _build_parser()
    ns = ap.parse_args(argv)
    ns.message = _resolve_message(ns, ap)   # file/stdin or inline; exits with a hint if neither

    try:
        intent = resolve_intent(ns, os.getcwd())
    except SmartError as e:
        print(f"commit_flow: {e}", file=sys.stderr)  # no PLAN yet — nothing was attempted
        return 1

    # Every mode checks the branch lifecycle through repocli before mutation.
    # Commit-only forbids publishing, not PR queries; unavailable or ambiguous state
    # cannot authorize work on a branch that may already be merged.
    try:
        gv = gate.evaluate(intent.repo)
    except ForgeError as e:
        print(f"commit_flow: PR state verification failed for {intent.repo}: {e}", file=sys.stderr)
        return 1
    plan: list[str] = [
        f"mode={intent.mode} repo={Path(intent.repo).name} ({intent.source}) "
        f"branch={gv.branch} target={intent.target}"
    ]
    try:
        branch = prepare_branch(intent, gv, plan)
        prepared = commit_domain.prepare(intent.repo, branch.branch, intent.files)
        pre_c = run_lifecycle_gate(intent, "pre_commit", list(prepared.paths), plan)   # configured lifecycle actions
        staged = stage_and_commit(intent, prepared, plan)
        if staged.committed:
            post_c = run_lifecycle_gate(intent, "post_commit", list(prepared.paths), plan)
            launch_background_relays(pre_c.to_launch + post_c.to_launch, intent.repo, plan)
        publish(intent, branch, staged, plan)
        RepoContext.refresh_branch(intent.repo)
    except (SmartError, commit_domain.CommitError, OSError) as e:
        _banner(plan)
        print(f"\n✗ {e}", file=sys.stderr)
        return 1

    _cleanup_commit_message_file(ns.message_file, intent, plan)
    _banner(plan)
    return 0


def _banner(plan: list[str]) -> None:
    print("PLAN:")
    for line in plan:
        print(f"  - {line}")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

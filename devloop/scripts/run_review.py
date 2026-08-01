#!/usr/bin/env python3
"""code-review hook 的后台执行体：跑配置的 review 引擎（默认 `ccr`，可切 `ocr`）审整条 MR 的全量改动，结果写 `.devloop/review.json`
并作为一条评论**发到该分支的 MR 上**——让 review 历史挂在 MR 上、可跟踪对比。

由 lifecycle 的 `review` signal hook（挂 `post_mr`）经 detach 起（见 docs/code-review.md）。审
`origin/<target>..HEAD`（整条分支 vs target）；查到分支的开放 MR 且有 finding（或有文件审失败）
才发评论——clean 不发，结论留 review.json；没有开放 MR 就只落 review.json。

为提准，自动给引擎拼 `--background`（业务上下文）：本次提交说明 + MR 标题/描述（detach 进程
自己经 git log / forge 取，不依赖会话）。

每次运行终态还追加一行到 `.devloop/review-history.jsonl`（append-only）——review.json 只留最新一次，
这条历史用于统计运行次数 / 跟踪。

advisory：从不挡 commit。引擎没装 / LLM 没配好 → 写 `status=skipped` 退出 0，不报错。
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from lib import cli, config, git_state, review_engine  # noqa: E402
from domain import review_feedback  # noqa: E402
from domain.context import base, record_active_repo, store  # noqa: E402
from domain.forge import ForgeError, pr_label  # noqa: E402
from lib.forge import forge_for_repo, resolve_forge  # noqa: E402

_MAX_COMMENT_FINDINGS = 30   # 评论里最多列几条，避免超长 MR 评论


def _head_sha(repo: str) -> str:
    r = subprocess.run(["git", "-C", repo, "rev-parse", "HEAD"], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def _branch(repo: str) -> str:
    r = subprocess.run(["git", "-C", repo, "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def _write(repo: str, branch: str, **fields) -> None:
    """写 review 段。`branch` 由调用方在**启动时冻结**后一路传下来，绝不在这里现问 live 分支。

    这里曾是 `git_state.get_current_branch(repo)` 现问，注释还写着「即使 checkout 移动过也正确」
    ——**恰恰相反**：review 是 detach 起的长时任务（分钟级），期间人 / agent 很可能已经切走分支。
    现问 live 分支的后果不是「结果丢了」，是**结果落到别的分支名下**：被审分支的 review.json 永远
    停在 running（下一轮注入把它读成 stale），而当前分支凭空拿到一份别人的 findings。
    「始终跟上最新」对一个审**固定**分支的任务是错的语义——它的对象在出生那一刻就定了。"""
    store.save_segment(repo, store.branch_segment(branch, "review"), fields)


def _append_history(repo: str, started: float, **fields) -> None:
    """每次 review **终态**追加一行到 `.devloop/review-history.jsonl`（append-only，与每次覆盖的
    review.json 并存）——review.json 只留最新一次，这里攒每次运行用于统计次数 / 跟踪历史。
    best-effort：写失败不影响 review 本身。"""
    rec = {"ts": round(base.now(), 1), "secs": round(base.now() - started, 1), **fields}
    try:
        p = store.state_dir(repo) / "review-history.jsonl"
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass


def _post_inline(forge, pr, comments: list, sha: str = "") -> tuple[int, list]:
    """把 findings 逐条发成可回复 thread，优先 diff 锚点（GitLab positioned discussion /
    GitHub review comment）——锚点让 forge 原生管理生命周期:后续 push 改了对应行,评论自动
    折叠成 outdated,不像普通 note 永远悬着。

    finding 自带粒度:带行号的是 **line-level**（"这行漏判空"）,不带的是 **file-level**
    （"这文件缺测试"）——后者不是信息缺失,而是本来就没有哪一行可指。所以 file-level 直接
    锚文件,line-level 才有「行锚不上退文件锚」这一级(最常见是 context 行 finding:行不在
    当前 diff 里)。两者都锚不上时再尝试无锚 thread（GitLab discussion），最后才进汇总。

    之所以尽量别掉进汇总:只有独立 thread 才能被回复打标（`ccr:label=`),而汇总里的 finding
    只是一条 note 里的一行文本,没有可回复的对象,等于退出了 ground truth 回收。
    返回 (thread 发布成功数, 回落列表),单条失败不影响其余。"""
    if forge is None or pr is None:
        return 0, comments
    posted, fallback = 0, []
    for c in comments[:_MAX_COMMENT_FINDINGS]:
        path = c.get("path") or ""
        line = c.get("end_line") or c.get("start_line") or 0   # 多行 finding 锚在末行
        body = (c.get("content") or "").strip()
        alias = (c.get("alias") or "").strip()
        if not body:
            fallback.append(c)
            continue
        head = "🤖 **devloop code-review**" + (f" · {alias}" if alias else "")
        # ccr:fp footer——finding 的稳定指纹（path+content hash），把这条评论和 session
        # finding / 复跑重现 / 人工标注（回复 `ccr:label=<verdict>`）join 到一起；
        # 回收约定见 ccr 仓 eval/README「人工标注统一约定」。
        fp = (c.get("fingerprint") or "").strip()
        foot = f"\n\n<sub>ccr:fp={fp}</sub>" if fp else ""
        key = (c.get("symbol_id") or path).strip()
        marker = review_feedback.history_marker(key=key, msg=body, sha=sha[:9], fp=fp) if key else ""
        rendered = f"{head}\n\n{body}{foot}" + (f"\n{marker}" if marker else "")
        anchored = False
        if path:
            # None = 文件级锚点。line-level 先试行锚、退文件锚;file-level 只有文件锚这一级。
            for anchor in ((int(line), None) if line else (None,)):
                try:
                    forge.comment(
                        pr.number,
                        rendered,
                        replyable=True,
                        path=path,
                        line=anchor,
                    )
                    posted += 1
                    anchored = True
                    break
                except ForgeError:
                    continue
        if anchored:
            continue
        try:
            forge.comment(pr.number, rendered, replyable=True)
            posted += 1
        except ForgeError:
            # GitHub 没有无锚 review thread；GitLab 也可能禁掉 discussions。最后才回汇总。
            fallback.append(c)
    fallback += comments[_MAX_COMMENT_FINDINGS:]
    return posted, fallback


def _format_comment(comments: list, failed: int, range_label: str, sha: str, models: dict | None = None,
                    cost_sec: int = 0, tool_label: str = "", inline_posted: int = 0) -> str:
    """把引擎结果格式化成一条 MR 评论(markdown)。run_review 自主发,无 agent 参与,故在此成文;
    优先级分级是 agent 在会话里做的事,这条历史评论只如实列出引擎的原始 findings。
    `comments` 是没能成为独立 thread 的回落部分;成功发布的只计数(`inline_posted`),内容在
    各自的 review thread 里。
    回落项没有行号时(file-level finding)只渲染 path,不拼空的 `:0-0`。"""
    head = f"🤖 **devloop code-review** · `{range_label}` · `{sha[:9]}`"
    if models:  # 这次 review 实际跑过的 model（routing alias×次数，去重）——review 级身份，clean 也打
        head += " · models: " + ", ".join(f"{a}×{n}" for a, n in sorted(models.items()))
    if cost_sec:  # 引擎自报的 review 耗时（整秒）——历史评论间可比,没报(0)不打
        head += f" · cost: {cost_sec}s"
    if tool_label:  # 引擎身份,如 `ccr v0.1.0`——引擎没报 version 就不打
        head += f" · {tool_label}"
    total = len(comments) + inline_posted
    if not total and not failed:
        return f"{head}\n\n✅ 无 findings(clean)。"
    bits = []
    if total:
        seg = f"**{total} finding(s)**"
        if inline_posted:
            seg += f"（{inline_posted} 条已作为独立 review thread 发布）"
        bits.append(seg)
    if failed:
        bits.append(f"⚠️ {failed} 个文件未能 review(LLM 超时 / token 超限等)")
    lines = [head, "", " · ".join(bits), ""]
    for c in comments[:_MAX_COMMENT_FINDINGS]:
        loc = c.get("path", "?")
        s, e = c.get("start_line", 0), c.get("end_line", 0)
        if s or e:
            loc += f":{s}-{e}"
        alias = (c.get("alias") or "").strip()   # 多 model 池里哪个 model 出的（引擎 routing alias），便于对比
        tag = f" ({alias})" if alias else ""
        body = (c.get("content") or "").strip().replace("\n", " ")
        fp = (c.get("fingerprint") or "").strip()
        if fp:
            tag += f" `ccr:fp={fp}`"   # 汇总列表也可 grep 到指纹（标注约定见 ccr eval/README）
        lines.append(f"- `{loc}`{tag} — {body[:300]}" if body else f"- `{loc}`{tag}")   # 空 content 不留悬空破折号
        key = (c.get("symbol_id") or c.get("path") or "").strip()
        if key and body:
            lines.append(review_feedback.history_marker(key=key, msg=body, sha=sha[:9], fp=fp))
    if len(comments) > _MAX_COMMENT_FINDINGS:
        lines.append(f"- … 另有 {len(comments) - _MAX_COMMENT_FINDINGS} 条,见 `.devloop/review.json`")
    return "\n".join(lines)


_BG_CAP = 1800   # background 每段上限：它会注入每个文件的 review prompt，必须压住 token


def _open_mr(repo: str, branch: str):
    """(forge, 该分支的开放 MR)——找一次，给 background 取标题/描述 + 发评论复用。无则补 None。"""
    if not branch:
        return None, None
    forge = forge_for_repo(repo)
    if forge is None:
        return None, None
    try:
        return forge, next((p for p in forge.prs_for_branch(branch) if p.is_open), None)
    except ForgeError:
        return forge, None


def _pull_request_identity(repo: str, pr) -> dict | None:
    """The complete external identity attached to a PR-bound review."""
    if pr is None:
        return None
    resolution = resolve_forge(repo)
    if resolution is None:
        return None
    return resolution.pull_request_identity(pr.number).to_dict()


def _biz_id(pull_request: dict | None) -> str | None:
    """把 devloop 的 PR/MR identity 投影成 CCR 不透明 biz_id；格式归 caller 所有。"""
    if not pull_request:
        return None
    source = pull_request.get("source")
    repository = pull_request.get("repository")
    number = pull_request.get("number")
    if not source or not repository or number is None:
        return None
    return f"{source}:{repository}#{number}"


def _build_background(repo: str, target: str, forge, pr, extra: str | None) -> str:
    """拼引擎的 `--background`（业务上下文，喂进每个文件的 review prompt 以提准）：
    本次提交说明（git log）+ MR 标题/描述（forge）+ 显式 `-b`。全是 detach 进程自己能拿到的，
    不依赖会话。每段 `_BG_CAP` 截断——它每文件都注，务必控长。"""
    parts = []
    if extra and extra.strip():
        parts.append(extra.strip()[:_BG_CAP])
    log = subprocess.run(
        ["git", "-C", repo, "log", f"origin/{target}..HEAD", "--no-merges", "--pretty=format:- %s%n%b"],
        capture_output=True, text=True,
    )
    if log.stdout.strip():
        parts.append("## 本次改动的提交说明\n" + log.stdout.strip()[:_BG_CAP])
    if forge is not None and pr is not None:
        title = (pr.title or "").strip()
        try:
            desc = (forge.description(pr.number) or "").strip()
        except ForgeError:
            desc = ""
        if title or desc:
            parts.append(f"## MR：{title}\n{desc[:_BG_CAP]}".rstrip())
    return "\n\n".join(parts).strip()


def _post(forge, pr, body: str) -> str:
    """把评论发到已解析的开放 MR;返回一句状态(供 stdout / review.json)。"""
    if forge is None or pr is None:
        return "no open MR — comment skipped"
    try:
        forge.comment(pr.number, body)
        return f"posted to {pr_label(forge.provider, pr.number)}"
    except ForgeError as e:
        return f"MR comment failed (non-fatal): {e}"


def _findings_for_history(comments: list, warnings: list) -> list:
    """Per-finding record for review-history.jsonl, tagged with its file's review
    status so analytics can distinguish complete findings from output produced by
    a file that later failed (timeout / token limit). This ledger is never fed back."""
    failed = {w.get("file"): (w.get("message") or "")
              for w in (warnings or []) if isinstance(w, dict) and w.get("type") == "subtask_error"}
    out = []
    for c in comments:
        path = c.get("path", "")
        rec = {"symbol_id": c.get("symbol_id") or "", "path": path, "msg": (c.get("content") or "").strip()}
        if path in failed:
            rec["status"], rec["reason"] = "failed", (failed[path][:120] or "review_error")
        else:
            rec["status"] = "ok"
        out.append(rec)
    return out


def _build_history_feed(forge, pr) -> tuple[str | None, list]:
    """Fetch the current PR/MR comments and materialize ccr's one-shot adapter input.

    The file is deliberately outside `.devloop`: Forge comments are the durable source,
    and losing this temporary file changes no future review.
    """
    if forge is None or pr is None:
        return None, []
    try:
        comments = forge.comments(pr.number)
    except ForgeError:
        return None, []
    feed = review_feedback.history_feed(comments)
    if not feed:
        return None, comments
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix="ccr-history-",
            suffix=".json",
            delete=False,
        ) as out:
            json.dump(feed, out, ensure_ascii=False)
            return out.name, comments
    except OSError:
        return None, comments


def main(argv: list[str]) -> int:
    ap = cli.ArgParser(prog="run_review.py", description="review the MR diff (ccr/ocr) → .devloop/review.json + MR comment")
    cli.add_repo_arg(ap)
    ap.add_argument("--background", "-b", default=None, help="optional business/requirement context for the review engine")
    ns = ap.parse_args(argv)
    resolved, _ = cli.resolve_repo_or_exit(ns, "run_review")
    repo = resolved.git_root
    record_active_repo(repo)
    # 审的是**哪条分支的哪个 sha**，在这里一次定死。本进程是 detach 起的、跑分钟级，期间
    # checkout 完全可能被切走——之后任何一处再问「现在是哪条分支 / HEAD 是谁」都会答出另一个
    # 对象。冻结点只有这一个，下面全程只用这两个值。
    branch, sha = _branch(repo), _head_sha(repo)
    started = base.now()
    _write(repo, branch, status="running", reviewed_sha=sha, comments=[], count=0, message="review in progress", generated_at=base.now())

    def skip(msg: str) -> int:
        _write(repo, branch, status="skipped", reviewed_sha=sha, comments=[], count=0, failed=0, message=msg, generated_at=base.now())
        _append_history(repo, started, status="skipped", sha=sha,
                        count=0, failed=0, message=msg)
        print(f"run_review: {msg} — skipped")
        return 0

    # devloop 只依赖 review_engine 协议——具体引擎（ccr / ocr / 别的）由配置选、adapter 实现。
    # `review` 误配成非 dict（如 "review": "ccr"）也不能崩——advisory 进程从不报错。
    review_cfg = config.load(repo).get("review")
    tool_name = review_cfg.get("tool") if isinstance(review_cfg, dict) else None
    engine = review_engine.resolve(tool_name)
    if not engine.available():
        return skip(f"{engine.name} CLI not installed ({engine.install_hint()})")
    if not engine.configured(repo):
        return skip(f"{engine.name} LLM not configured — run `{engine.name} config set llm.*`")

    target = git_state.local_default_target(repo)
    range_label = f"origin/{target}..HEAD"
    forge, pr = _open_mr(repo, branch)                              # 冻结的 branch：别把 A 的 findings 发到 B 的 PR
    background = _build_background(repo, target, forge, pr, ns.background)
    pull_request = _pull_request_identity(repo, pr)
    history_path, prior_comments = (
        _build_history_feed(forge, pr) if engine.name == "ccr" else (None, [])
    )  # current Forge comments → one-shot ccr --history

    # to_ref 传**冻结的 sha**，不是字面量 "HEAD"：ccr 在它自己启动那一刻才解析 HEAD，checkout
    # 若已切走，它审的就是另一条分支——而我们早已把 reviewed_sha 记成上面那个 sha，记录就成了谎。
    # 传 sha 之后「记录说审了什么」与「实际审了什么」由构造保证一致。
    try:
        result = engine.review(
            repo, f"origin/{target}", sha, background, history_path,
            biz_id=_biz_id(pull_request),
        )
    finally:
        if history_path:
            Path(history_path).unlink(missing_ok=True)
    if not result.ok:
        _write(repo, branch, status="error", reviewed_sha=sha, comments=[], count=0, failed=0,
               message=result.error, pull_request=pull_request, generated_at=base.now())
        _append_history(repo, started, status="error", sha=sha,
                        pull_request=pull_request,
                        count=0, failed=0, range=range_label)
        print(f"run_review: {engine.name} output not parseable — see .devloop/review.json")
        return 0

    comments = result.comments
    tool_label = f"{engine.name} {result.tool_version}" if result.tool_version else ""
    suppressed = review_feedback.suppress_delivery_fingerprints(prior_comments)
    publish_comments = []
    for comment in comments:
        fp = (comment.get("fingerprint") or "").strip()
        if fp and fp in suppressed:
            continue
        publish_comments.append(comment)
    deduped = len(comments) - len(publish_comments)
    inline_posted, fallback = _post_inline(
        forge, pr, publish_comments, sha,
    )   # inline 优先,锚不上的进汇总
    if not publish_comments and not result.failed:
        # clean（无 finding 且全部文件审完）不发 MR 评论——往在途 MR 反复 push 会攒出一串
        # 无信息量的 "✅ clean" 刷屏；clean 结论已在 review.json（下一轮注入 Review: clean）。
        # failed>0 仍发：没审完不是可信的 clean，要在 MR 上留痕。
        posted = (
            f"{deduped} existing finding(s) unchanged — MR comment skipped"
            if deduped else "clean — MR comment skipped"
        )
    else:
        posted = _post(forge, pr, _format_comment(fallback, result.failed, range_label, sha, result.models,
                                                  result.cost_sec, tool_label, inline_posted))
    _write(repo, branch, status=result.status, reviewed_sha=sha, comments=comments,
           count=len(comments), failed=result.failed, warnings=result.warnings, message=result.message,
           cost_sec=result.cost_sec, tool_version=result.tool_version, inline_posted=inline_posted,
           deduped=deduped,
           reviewed_range=range_label, mr_comment=posted, pull_request=pull_request,
           generated_at=base.now())
    _append_history(repo, started, status=result.status, sha=sha,
                    pull_request=pull_request,
                    count=len(comments), failed=result.failed,
                    findings=_findings_for_history(comments, result.warnings),
                    range=range_label, posted=posted)
    print(f"run_review: {len(comments)} comment(s), {result.failed} file(s) failed on {range_label}"
          + (f" · {posted}" if posted else "") + " → .devloop/review.json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

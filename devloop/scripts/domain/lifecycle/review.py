"""code-review signal hook —— 返回一个后台 ocr review 的 relay，结果落 `.devloop/review.json`。

这是 **signal hook**：不在 dispatch（subprocess）里跑 ocr——那会挡住 commit，且 subprocess
派生的子进程 harness 不跟踪、跑完不唤醒会话。它返回带 `relay` 的 HookResult；relay 描述的命令
由 `commit_flow` 在所裹的 git 动作后 detach 起（审 `origin/<target>..HEAD`），结果经状态
总线下轮浮现、分级汇报（见 docs/code-review.md）。

runner 可用时返回 relay；缺失时记录 advisory error，从不挡 commit。
"""
from __future__ import annotations

from lib import config, git_state
from domain.context import base, store
from domain.lifecycle.base import BackgroundSpec, HookResult


def review(repo: str, paths: list[str] | None = None) -> HookResult:
    """detach 起 run_review——审整条分支的全量改动（origin/<target>..HEAD），结果写 review.json，
    且分支有开放 MR 时发评论做历史。挂哪个相位由 config 决定（不限 post_mr）。

    `paths`（相位的改动范围）**刻意不用**：review 的范围恒是整条分支 vs target，与挂在哪个相位
    无关——挂 post_commit 也审全条分支，而不是只审刚落地那个 commit。范围由 run_review 在后台
    自己算（detach 起时才跑，那时的 HEAD 才是最终态）。签名收下它只为满足 handler 契约。"""
    del paths
    script_path = config.plugin_root() / "scripts" / "run_review.py"
    # Python can start successfully even when its script is missing. Surface that
    # packaging failure here, before detach would leave only an unread log entry.
    if not script_path.is_file():
        message = f"review runner not found: {script_path}"
        branch = git_state.get_current_branch(repo)
        store.save_segment(repo, store.branch_segment(branch, "review"), {
            "status": "error", "reviewed_sha": git_state.get_head_sha(repo),
            "count": 0, "failed": 0, "message": message, "generated_at": base.now(),
        })
        return HookResult("review", ok=False, summary=message, advisory=True)
    script = str(script_path)
    spec = BackgroundSpec("review", ["python3", script, "--repo", repo],
                          note="ocr review origin/<target>..HEAD → .devloop/review.json + MR comment")
    return HookResult("review", ok=True, summary="launched background code-review", relay=spec)

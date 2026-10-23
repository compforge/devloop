---
name: git-ops
description: Commit, push, rebase, manage GitHub PRs or GitLab MRs, create/resume branches and worktrees, or publish releases. Use for gcam / gcamp / gcampr / rebase / 解决冲突 / 提 PR / 提 MR / 看 PR / 看 MR / 关 PR / 关 MR / checkout / worktree / 切新分支 / 发版.
---

Use devloop's managed scripts for Git and Forge operations; read-only Git inspection is unrestricted.
Do not replace these workflows with raw Git mutations or provider-specific API calls.

`<PLUGIN_ROOT>` is the installed plugin directory: `${CLAUDE_PLUGIN_ROOT}` on Claude Code,
`${PLUGIN_ROOT}` on Codex. Run Python entrypoints through
`<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/<name>.py` for their locked dependencies.

## Task boundaries

- Continue an active branch only when the task belongs to its proposal. New work starts through
  branch/worktree creation before editing; a merged/closed branch is historical, not a new baseline.
- Preserve other work and session-owned checkouts. Rebase is a separate requested operation.
- Select the actual repository and task files explicitly when the workspace contains other work.
- Follow the script's `PLAN:` and live checks. Repair failures within the authorized task and retry
  the owning entrypoint; preserve validation gates and report any remaining blocker.
- Stop at the requested commit, push, PR/MR, or release outcome. Merge remains a human action.

## Routes

| Task | Read |
|---|---|
| Start a feature branch | [Branch](references/branch.md) |
| Create/resume an isolated checkout | [Worktree](references/worktree.md) |
| Commit, push, create/reuse PR/MR | [Commit flow](references/commit-flow.md) |
| Rebase an existing branch | [Rebase](references/rebase.md) |
| Show/list/update/close/reply on PR/MR | [PR management](references/pr-management.md) |
| Publish or inspect a release | [Release](references/release.md) |

Validation scope and reuse are managed by the workflow; use [validate](../validate/SKILL.md) for
standalone checks. Commit-triggered review is automatic and advisory; use
[review](../review/SKILL.md) to inspect or handle its findings.

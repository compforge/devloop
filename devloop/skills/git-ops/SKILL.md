---
name: git-ops
description: Commit, push, safely rebase an existing branch, create/read/update/close a pull/merge request (GitHub PR or GitLab MR), cut a feature branch, create/resume a managed worktree, or release. Triggers — gcam / gcamp / gcampr / rebase / 解决冲突 / 提 PR / 提 MR / pull request / merge request / 看 PR / 看 MR / 关 PR / 关 MR / checkout / worktree / 切新分支 / 起新分支 / 发版.
---

Use devloop's scripts as the executable policy. Inspect Git state freely, but do not replace an
owned workflow with raw `git commit/push`, `git worktree add`, force-push, or hand-written
`curl`/`glab`/`gh` forge calls.

`<PLUGIN_ROOT>` maps to `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.

## Before mutation

Resolve the task's intent and the live branch/PR state before changing HEAD or files. The current
checkout is a work site, not automatically the correct baseline for a new task.

| State | Meaning and action |
|---|---|
| `PROTECTED` | Trunk or release branch. Analyze it only when it is the intended baseline; create a feature branch before changes. |
| `HEALTHY` | Active feature branch. Continue only when the task belongs to this branch. |
| `IN-FLIGHT` | PR/MR open. Keep it for fixes to that proposal; new work needs a fresh branch. |
| `INACTIVE` | PR/MR merged/closed; historical branch. Do not use it as the current-state baseline or edit it. |

Release/version is a branch role, not another lifecycle state. Use one as the baseline only when
the task explicitly targets that version.

## Mutation rules

1. Start new work with the branch-create transaction before editing. Commit-time `--branch` remains
   the compatibility path for intentional edit-then-cut flows. Both cut from freshly fetched
   `origin/<target>`; stacking requires explicit `--base`.
2. Preserve existing branches and worktrees as-is. Rebase/reset is a separate explicit operation.
3. Revalidate forge, remote, and lease state at the mutation boundary; injected context is guidance,
   while the owning script's live check is authoritative.
4. Scope staging to the user's files. Never use repo-wide `git add -A`, and never let an ambiguous
   workspace cwd silently select another repo.
5. Trust and surface each script's `PLAN:` result. Stop on failure instead of improvising a bypass.
   Merge remains a human action.

## Routes

- Start new work on a fresh feature branch → read [[references/branch|branch flow]].
- Commit, push, or create/reuse a PR/MR → read [[references/commit-flow|commit flow]].
- Create or resume an isolated checkout → read [[references/worktree|managed worktrees]].
- Rebase an existing PR/MR branch → read [[references/rebase|safe rebase]].
- Inspect, update, close, or reply on a PR/MR → read [[references/pr-management|PR/MR management]].
- Create or inspect a release → read [[references/release|release flow]].

Commit-triggered code review is advisory and automatic. Report a surfaced result without taking
over the session; use the `label-review` skill only when findings need verdict labels.

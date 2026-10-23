---
name: monitor
description: Reconcile local branches/worktrees with GitHub/GitLab PR/MR lifecycle, clean finished worktrees, or configure recurring reconciliation. Use for lifecycle sweeps and ongoing PR/MR monitoring. For a one-time PR/MR status query, use git-ops.
---

For status only, use [PR show/list](../git-ops/references/pr-management.md).
Reconciliation applies repository lifecycle policy and can remove finished worktrees; it preserves
branches and never merges a PR/MR. Use it for lifecycle monitoring or requested cleanup.

`<PLUGIN_ROOT>` is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.
Discover the task and run one bounded sweep in the requested repository/workspace:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_task.py list
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_task.py run pr-lifecycle-reconcile . --report
```

Report `changes`, completed/deferred `actions`, and refresh failures. `pull_requests` includes local
branches without a checkout. A false `updated` or repo `error` means freshness is unknown, not that
no PR exists. Nonzero exit can indicate refresh failure or deferred cleanup; inspect the report.
For missed cleanup, logs are in the main checkout's `.devloop/tmp/pr-lifecycle-reconcile.log`
and `.devloop/tasks.jsonl`.

## Recurring monitoring

When requested under Codex, use its native Scheduled-task capability with the user's cadence
or the discovered task's `interval_seconds`. Each invocation runs one sweep; never pass `--loop`
from a skill or Scheduled task. Claude's native monitor owns its own repeating adapter.

Use a project-scoped prompt:

```text
Run $devloop:monitor for this project. Report PR/MR state changes, completed or deferred
reconciliation actions, and refresh failures. If nothing changed and every refresh succeeded,
report only "no changes". Never merge a PR/MR or delete a branch.
```

If scheduling is unavailable in the current client, provide the prompt and cadence without claiming
a task was installed. Opportunistic lifecycle-hook sweeps are not a durable timer.

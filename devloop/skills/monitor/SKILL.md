---
name: monitor
description: Reconcile local branches and worktrees with GitHub/GitLab PR/MR state, report lifecycle changes, or configure Codex Scheduled tasks for recurring devloop checks. Use when asked to monitor/check PR or MR status, clean finished worktrees, reconcile local PRs, or set up recurring PR/MR monitoring.
---

Discover the canonical task first, then run one bounded reconciliation sweep:

```console
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_task.py list
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_task.py run pr-lifecycle-reconcile . --report
```

Read the JSON report as follows:

- `pull_requests` is every local branch with a PR/MR, including branches with no checkout;
- `checkout` is `primary`, `managed`, `external`, or `null`;
- `changes` records newly discovered PRs/MRs and authoritative state transitions;
- `actions` records completed or deferred lifecycle reactions and their reason;
- a false `updated` field or repo-level `error` means that source was not refreshed, so do not
  infer absence or authorize cleanup from stale data.

Never pass `--loop` from a skill or Scheduled task. Looping is only the Claude native-monitor
adapter; task discovery, one-shot behavior, report shape, and reconciliation policy are shared.

Codex plugins cannot register a Scheduled task during installation. The plugin's Codex
SessionStart and PostToolUse hooks therefore provide a throttled, non-blocking, repo-level
opportunistic trigger for this same one-shot task. Treat it as an active-use fallback, not a
durable timer: it cannot run while Codex has no lifecycle events.

When the user asks to monitor continuously under Codex, use the native Scheduled-task capability
instead of a daemon. Create or update a project-scoped task with the requested cadence; when none
is given, use the discovered task's `interval_seconds` (round only when the scheduler requires a
coarser unit). Run it in the local project and use this durable prompt:

```text
Run $devloop:monitor for this project. Report PR/MR state changes, completed or deferred
reconciliation actions, and refresh failures. If nothing changed and every refresh succeeded,
report only "no changes". Never merge a PR/MR or delete a branch.
```

Prefer a task in the current chat when the user wants the existing context retained; use a
standalone task when each check should be an independent run. If the current client cannot manage
Scheduled tasks, give the prompt above and direct the user to Codex in the desktop app or ChatGPT
web/desktop Scheduled view.

`<PLUGIN_ROOT>` maps to `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.

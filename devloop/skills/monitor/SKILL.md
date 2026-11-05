---
name: monitor
description: Inspect PR/MR state or clean worktrees with repocli. Use for requested cleanup or user-requested recurring checks; one-time PR status queries also use git-ops.
---

The AI invokes repocli directly in each requested repository:

```bash
repocli pr list --repo <repo> --state all --json
repocli worktree clean --repo <repo> --dry-run --json
repocli worktree clean --repo <repo> --json
```

For status-only requests, only query PRs. For requested cleanup, inspect the preview and execute
within the authorized repository scope. RepoKit owns PR evidence, worktree protections and
`max_count` / `max_prepared`; do not duplicate those rules or remove directories manually.
Report completed/skipped actions and errors. A failed query is unknown state, never proof that
no PR exists. Never merge a PR or delete a branch as part of monitoring.

When recurring checks are explicitly requested, use the Harness's native scheduling capability
to invoke this skill at the requested cadence. Devloop installs no timer, task runner or automatic
sweep. If scheduling is unavailable, provide the task prompt without claiming it was installed.

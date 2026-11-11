---
name: monitor
description: Inspect PR/MR state or reclaim repository caches and worktrees with repocli. Use for requested cleanup or user-requested recurring checks; one-time PR status queries also use git-ops.
---

Read [repocli results and recovery](../../references/repocli.md#command-results-and-recovery).
The AI invokes repocli directly, selecting the scope authorized by the user:

```bash
repocli pr list --repo <repo> --state all --json
# All repositories registered in the selected RepoKit home
repocli clean --dry-run --json
repocli clean --json

# One repository identity, including its registered clones
repocli clean --repo <repo> --dry-run --json
repocli clean --repo <repo> --json

# One clone
repocli worktree clean --repo <repo> --dry-run --json
repocli worktree clean --repo <repo> --json
```

For status-only requests, only query PRs. For requested cleanup, inspect the preview and execute
within the authorized scope. Do not expand a one-repository request to a global sweep.
`clean` reads the selected home (`--home`, `REPOKIT_HOME`, or `~/.repokit`); its default
30-day threshold expires repository caches, not every worktree older than 30 days. Both
cleanup commands use the same service and repository retention policy. RepoKit owns PR evidence, worktree protections and
`max_count` / `max_prepared`; do not duplicate those rules or remove directories manually.
RepoKit preserves primary checkouts, branch refs, config.json and local checkout registration.
Retained worktrees remain discoverable on later sweeps; devloop does not rebuild the inventory
or renew access just to maintain it. Missing credentials are resolved in RepoKit config.json.
Read the preview and cleanup report in `data`, and check `outcome` plus diagnostics even
on nonzero exit. For partial cleanup, report completed/skipped actions and remaining errors;
obtain a fresh preview before retrying remaining work. A skipped action is not itself a failure;
`registration_only` means only lightweight registration remains. `estimatedBytes` is the logical
size of completed/planned actions, not measured filesystem free space. A failed query is unknown state, never
proof that no PR exists. Report elapsed time from `cost.wallSeconds`. Never merge a PR or
delete a branch as part of monitoring.

When recurring checks are explicitly requested, use the Harness's native scheduling capability
to invoke this skill at the requested cadence. Devloop installs no timer, task runner or automatic
sweep. If scheduling is unavailable, provide the task prompt without claiming it was installed.

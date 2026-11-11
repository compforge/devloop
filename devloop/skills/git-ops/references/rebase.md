# Rebase

```bash
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh start --repo <name|path> [--target <branch>]
# Resolve conflicts, stage the resolved files, and continue as needed.
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh continue --repo <name|path>
# Validate the resulting tree before publishing (see below).
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh finish --repo <name|path>
```

The helper checks development policy and invokes `repocli git rebase`; it owns no Git transaction
or recovery file. The target defaults to the open PR/MR target, then repository trunk. An explicit
conflicting PR target, protected/inactive branch or another active checkout owner is rejected.
Continue/abort allow Git's detached rebase state; RepoCLI verifies the saved operation identity.

Run [validate](../../validate/SKILL.md) after resolving the rebase and before `finish`;
`finish` does not run validation itself. It publishes using the exact remote lease captured by
`start`, refusing an intervening remote push. Do not publish a rebase through gcamp/gcampr.
A lost push response is reconciled against the frozen commit before another push is considered.

Use `status` to inspect the transaction; `abort` restores only a matching in-progress Git rebase
and never resets a completed rewrite. RepoCLI retains terminal evidence until the next start.
Unavailable/malformed CLI results and unknown writes require inspection, not an SDK fallback.
A confirmed `paused` result is not ready for publication; a context-refresh warning does not
undo a confirmed Git action.

For explicit diagnostic observation, the same source is available directly:

```bash
repocli git rebase status --repo <path> --json
```

RepoCLI 0.73.0 or later is required. [Result fields and recovery](../../../references/repocli.md#rebase-lifecycle)
are authoritative; do not read Git metadata recovery files from devloop.

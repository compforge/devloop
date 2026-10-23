# Rebase

```bash
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh start --repo <name|path> [--target <branch>]
# Resolve conflicts, stage the resolved files, and continue as needed.
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh continue --repo <name|path>
# Validate the resulting tree before publishing (see below).
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh finish --repo <name|path>
```

Run [validate](../../validate/SKILL.md) after resolving the rebase and before `finish`;
`finish` does not run validation itself. It publishes using the exact remote lease captured by
`start`, refusing an intervening remote push. Do not publish a rebase through gcamp/gcampr.

The target defaults to the open PR/MR target, then repository trunk. Use `status` to inspect the
transaction; `abort` works only while Git is still rebasing and does not reset a completed rebase.

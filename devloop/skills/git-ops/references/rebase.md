# Safe rebase

Treat rebase as a resumable transaction. Do not route it through gcamp/gcampr or issue a raw force
push.

```bash
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh start --repo <name|path> [--target <branch>]
# Resolve conflicts and stage only the resolved files.
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh continue --repo <name|path>  # repeat if needed
# Run relevant tests before publishing.
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh finish --repo <name|path>
```

`start` captures the current remote source SHA before rewriting history. `finish` publishes with an
exact `--force-with-lease`; an intervening remote push fails closed. The target defaults to the open
PR/MR target, then repository trunk.

Inspect with `smart_rebase.sh status --repo ...`. While Git is still rebasing, abort with
`smart_rebase.sh abort --repo ...`; after completion, abort refuses rather than guessing a reset
target.

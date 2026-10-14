# Start new work on a branch

Create the development branch before editing:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/branch.py create <name> [--repo <name|path>] [--target-repo current|parent] [--target <branch>]
```

The transaction refreshes the selected repository’s branch (current by default; direct parent with `--target-repo parent`), creates and switches to the branch, records its exact
fork point, and claims the checkout for the current session. It is idempotent only when the checkout
is already on that branch; an existing branch elsewhere is not rewritten or silently resumed.

The working tree must be clean by default. If existing tracked and untracked changes intentionally
belong to the new branch, pass `--carry-changes`. Use `--base <ref>` only for intentional stacking.

When another session owns the checkout, do not switch it. Follow the returned guidance and create a
managed worktree with `<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>`.

# Branch

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/branch.py create <name> [--repo <name|path>] [--target <branch>]
```

Creation starts from freshly fetched `origin/<target>` and claims the checkout for this session.
Use `--base <ref>` for intentional stacking; the current checkout is not the default baseline.

A clean tree is required unless existing changes intentionally belong to the new branch
(`--carry-changes`). An existing branch elsewhere is not silently resumed or rewritten.
For another session's checkout, use a [managed worktree](worktree.md).

The workflow delegates Git creation, remote-base refresh and change preservation to
`repocli git branch create` (CLI 0.74.0+). If carry fails after checkout, the new branch
and its devloop context remain selected. Inspect the exact retained stash and
`repocli git branch status <name>` before recovery; do not rerun create or stash apply blindly.

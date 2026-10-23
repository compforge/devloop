# Branch

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/branch.py create <name> [--repo <name|path>] [--target <branch>]
```

Creation starts from freshly fetched `origin/<target>` and claims the checkout for this session.
Use `--base <ref>` for intentional stacking; the current checkout is not the default baseline.

A clean tree is required unless existing changes intentionally belong to the new branch
(`--carry-changes`). An existing branch elsewhere is not silently resumed or rewritten.
For another session's checkout, use a [managed worktree](worktree.md).

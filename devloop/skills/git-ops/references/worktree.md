# Worktree

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>
```

A new tag creates `worktree-<tag>` from freshly fetched `origin/<target>`.
An existing path or retained branch resumes without rebase/reset: reuse a tag only for the same
work, and choose a new tag for an independent task. Use `cd` to select an existing checkout.

Updating an existing branch's baseline uses the separate [rebase workflow](rebase.md).

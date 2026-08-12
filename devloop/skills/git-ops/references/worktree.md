# Managed worktrees

Use ordinary `cd` to select an existing checkout. When another session needs isolation, run:

```bash
python3 <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <short-unique-tag>
```

A new tag creates `worktree-<tag>` from freshly fetched `origin/<target>` and refuses creation when
the baseline cannot be refreshed. An existing worktree path or retained branch is resumed without
rebase/reset.

Reuse a tag only to continue the same work. Choose a new tag for independent work; update an existing
branch's baseline through a separate explicit Git operation. Do not run raw `git worktree add`.

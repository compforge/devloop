# Worktree

Create or reuse a named worktree through RepoCLI:

```bash
repocli worktree ensure <name> --repo <repo> --branch <branch> --base <base-branch> --remote origin --prepare --timeout 12m --json
```

Pass the actual repository explicitly with `--repo`. `<name>` is a single directory name,
independent of the Git branch. RepoKit resolves the primary checkout and places the worktree
at `<primary-checkout>/.worktrees/<name>`, including when the repository is selected through
a symlink or linked checkout. Use `data.checkout` as the working directory.

Require a succeeded or partial envelope, `data.confirmed=true`, matching name/branch and an
absolute `data.checkout`. `created` refreshes the remote base before creation; `resumed`
checks out an existing branch; `reused` verifies the registered checkout. Existing work is
preserved. An unknown result requires observation before retry.

`--prepare` prepares declared dependency Bins. Inspect `data.ready`, `data.preparation` and
diagnostics separately from checkout confirmation. Partial preparation or observation warnings
preserve the confirmed checkout; dependency readiness does not establish validation success.

For repository lookup and devloop task naming, use:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>
```

This helper selects the name, `worktree-<tag>` branch, base and preparation policy; RepoKit
owns placement and lifecycle. Reuse a name only for the same work. Task/session ownership
belongs to devloop. Updating a branch baseline uses the [rebase workflow](rebase.md).

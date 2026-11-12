# Worktree

For devloop repository lookup and naming policy:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>
```

The helper selects `.worktrees/<tag>`, `worktree-<tag>` and the base, then invokes RepoKit.
With an explicit repository, path, branch and base, the same lifecycle can be composed directly:

```bash
repocli worktree ensure <path> --branch <branch> --base <base-branch> --remote origin --repo <repo> --prepare --timeout 12m --json
```

Require a succeeded or partial envelope, `data.confirmed=true` and matching checkout/branch before using the checkout.
`data.ready` and `data.preparation` report dependency readiness independently; partial preparation does not undo creation.
`created` refreshes the remote base first; `resumed` restores an existing branch at a new path;
`reused` verifies the registered checkout. Existing work is never reset or rebased.
Unknown creation results require observation before retry. Publication and preparation warnings
retain a confirmed checkout; they do not prove dependencies ready or validation passed.

Reuse a tag only for the same work; choose a new tag for an independent task. Task/session ownership
stays with devloop. Use `cd` to select the confirmed checkout. Updating its baseline uses the separate
[rebase workflow](rebase.md).

# Worktree

For devloop repository lookup and naming policy:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>
```

The helper selects the worktree name, `worktree-<tag>` branch and base, then invokes RepoKit.
RepoKit owns placement at `<primary-checkout>/.worktrees/<name>`, including symlink and linked-checkout resolution.
Always pass `--repo` explicitly; the positional argument is a single directory name, never a path.
Use the returned `data.checkout` for subsequent work. The same lifecycle can be invoked directly:

```bash
repocli worktree ensure <name> --branch <branch> --base <base-branch> --remote origin --repo <repo> --prepare --timeout 12m --json
```

Require a succeeded or partial envelope, `data.confirmed=true`, matching name/branch and an absolute returned checkout before using the checkout.
`data.ready` and `data.preparation` report dependency readiness independently; partial preparation does not undo creation.
`created` refreshes the remote base first; `resumed` restores an existing branch at a new path;
`reused` verifies the registered checkout. Existing work is never reset or rebased.
Unknown creation results require observation before retry. Publication and preparation warnings
retain a confirmed checkout; they do not prove dependencies ready or validation passed.

Reuse a tag only for the same work; choose a new tag for an independent task. Task/session ownership
stays with devloop. Use `cd` to select the confirmed checkout. Updating its baseline uses the separate
[rebase workflow](rebase.md).

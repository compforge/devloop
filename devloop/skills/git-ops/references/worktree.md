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

RepoKit ensure registers confirmed checkouts and reports registration diagnostics. RepoKit home
contains repository state; `.devloop` contains workflow and session state.

## Dependency preparation

`--prepare` prepares declared dependency Bins. Inspect `data.ready`, `data.preparation` and
diagnostics separately from checkout confirmation. `ready=false` preserves each Bin's reason
and installation output as warnings. Partial preparation or observation warnings preserve the
confirmed checkout; dependency readiness does not establish validation success.

Use the current checkout's dependency environment. Worktrees share package-manager caches;
`node_modules`, Python virtual environments and editable installs belong to each checkout.
The plugin's `scripts/python` environment is separate from the inspected project's environment.

For an existing checkout or changed lockfiles, run:

```bash
repocli depot prepare --repo <checkout> --timeout 10m --json
```

`depot inspect` provides read-only diagnostics. `validate` runs checks against the prepared
environment. RepoKit owns Bin fingerprints, installation locks, receipts, shared-Bin deduplication
and phase costs; see [Component resources](../../../docs/repository.md#component-与依赖资源).
The CLI timeout bounds the round; the Python process adapter allows another ten seconds for
termination and result serialization.

## Task naming

For repository lookup and devloop task naming, use:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <tag>
```

This helper selects the name, `worktree-<tag>` branch, base and preparation policy; RepoKit
owns placement and lifecycle. Reuse a name only for the same work. Task/session ownership
belongs to devloop. Updating a branch baseline uses the [rebase workflow](rebase.md).

# Release

Use repocli 0.70.0+ directly for Forge Release operations:

```bash
repocli release latest --repo <path> --json
repocli release show <tag> --repo <path> --json
repocli release create <tag> --target <verified-remote-commit> --title <name> --notes-file <path> --repo <path> --json
```

Read the project's release contract first. Select the version, version line and release target
from its version source and requested scope. RepoKit accepts Git tag names, does not enforce
SemVer progression and never chooses a default branch. `latest` reports the provider's selection
in `data.selection`: GitHub's published latest Release or GitLab's released_at ordering; neither
is a maximum-version calculation. Check the relevant version line before choosing a new version.

Write notes from changes since the appropriate baseline, grouped by user-visible outcomes with
upgrade/compatibility actions where needed. Provide meaningful notes unless the project's contract
explicitly permits an empty body. `--notes-file -` reads stdin; file contents are preserved exactly.
Use `--target-repository` for an explicit repository on the same Forge when origin is not the target.

Accept publication only when `outcome` is `succeeded` and `data.confirmed` is true. Check
`data.targetCommit` against the intended commit and inspect `data.release` for full notes and URL.
An identical existing Release is a confirmed no-op; differing commit, name, notes or publication
state is a conflict. There is no automatic overwrite or retry. `writeAttempted` does not prove
creation. Inspect `cost.phases` for prepare/preflight/write/verify costs.

For unknown results or interrupted output, use `release show` on the same repository/tag before
retrying. A successful `data.release: null` is absence; a failed query is not. Compare the actual
`targetCommit`, name, notes and draft/prerelease/upcoming state. A post-write conflict may leave
remote objects, so report the observation and resolve the discrepancy before another mutation.

Package publishing, deployment and assets remain project workflows. Report the confirmed Release
URL separately from those outcomes. Release commands do not run PR/worktree maintenance.

## Repository-owned release workflows

When a repository publishes its Release from a tag-triggered CI workflow, publish tags through
`repocli git tag publish` (repocli 0.69.0+) instead of creating a competing Release first:

```bash
repocli git tag publish toolkit/go/vX.Y.Z apps/cli/vX.Y.Z --target <verified-commit> --repo <repo> --json
repocli git tag publish vX.Y.Z --target <same-commit> --repo <repo> --json
```

Read the repository's release contract for tag order. Each invocation resolves one explicit target,
checks every existing remote tag, atomically pushes missing tags without force, and verifies their
remote targets at the configured remote's single push URL. The command publishes lightweight tags;
existing annotated tags are compared by their peeled commit. Version format, increment policy and
module order come from the project; RepoKit validates Git ref syntax only.

Accept success only when `outcome` is `succeeded` and `data.confirmed` is true. Inspect each
`data.tags[].status` (`present`, `missing`, `conflict`, `unknown`), `targetCommit` and phase costs.
A failed or canceled verification after push is unknown, even if the push exited successfully.
Existing tags at another commit are errors; uncertain pushes are observed before
any retry. Follow the repository CI to its terminal status and verify the Release assets separately.

# Release

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py latest
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py create <version> [--target <ref>] [--title ...] --notes-file <path>
```

Use `--repo <name|path>` when repository selection is ambiguous. The CLI creates a Forge Release
and tag server-side; package publishing and deployment are separate project workflows.

Resolve the version from the project's version source and the requested release scope. The CLI
requires `vX.Y.Z` newer than the latest release and defaults to remote trunk. Use another target
when the task calls for it.

Write notes from the changes since the previous release, grouped by user-visible outcomes with
upgrade/compatibility actions where needed. After publication, verify the tag target and Release
body, then report the Release URL and any separately requested publication/deployment outcome.

## Repository-owned release workflows

When a repository publishes its Release from a tag-triggered CI workflow, publish tags through
`release.py tag` instead of creating a competing Release first:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py tag toolkit/go/vX.Y.Z apps/cli/vX.Y.Z --target <verified-commit> --repo <repo>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py tag vX.Y.Z --target <same-commit> --repo <repo>
```

Read the repository's release contract for tag order. Each invocation resolves one explicit target,
checks every existing remote tag, atomically pushes missing tags without force, and verifies their
remote targets. Existing tags at another commit are errors; uncertain pushes are observed before
any retry. Follow the repository CI to its terminal status and verify the Release assets separately.

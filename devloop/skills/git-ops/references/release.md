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

# Release flow

## Boundary

devloop owns the safe Repo/Forge transaction: validate a monotonic semver, resolve the target, and
create the Release/tag server-side without mutating the working tree. The project and agent own the
release meaning: which version to publish, what changed for users, compatibility guidance, and any
deployment that follows. Never let a mechanical PR/MR list stand in for that semantic summary.

## Prepare the notes

1. Read the latest release and resolve the intended target. Default to the remote trunk; use another
   ref only when the user explicitly targets it.
2. Verify the requested version against the project's version source and compare the last release
   tag with the target. Inspect commit subjects plus the relevant PR/MR bodies or diffs; titles alone
   are evidence, not release notes.
3. Synthesize changes by user-visible outcome, not by PR/MR. Multiple PRs that implement or repair
   one capability become one bullet, with all relevant references collected at the end. Internal
   refactors, tests, and dependency bumps appear only when they change behavior or require action.
4. Write a concise notes file. Use these non-empty sections by default:
   - `## New Features` for new capabilities and meaningful enhancements.
   - `## Bug Fixes` for corrected behavior and reliability fixes.
   Add `## Breaking Changes` or `## Upgrade Notes` before them when users must act. Add narrower
   sections such as Performance, Documentation, or Dependencies only when they materially help the
   reader. End with a full-compare link for traceability instead of a raw PR/MR inventory.

For a very small release, include only the applicable section. PR/MR titles and labels are evidence;
do not mechanically copy or classify them without reading their bodies or diffs.

## Publish and verify

Use the forge-backed release CLI:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py create <version> [--target <ref>] [--title ...] [--notes ... | --notes-file <path>]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py latest
```

- Require semver `vX.Y.Z`, strictly newer than the latest release.
- Release notes are required. Prefer `--notes-file` for anything beyond a one-line note.
- Pass `--repo <name|path>` when repo selection is ambiguous.
- After publishing, verify the tag target and the rendered Release body, then surface the Release URL.

Fetch tags afterward only if the local checkout needs the new server-side tag.

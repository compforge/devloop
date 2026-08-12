# Release flow

Use the forge-backed release CLI; it creates the tag server-side without mutating the working tree:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py create <version> [--target <ref>] [--title ...] [--notes ... | --notes-file <path>]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py latest
```

- Require semver `vX.Y.Z`, strictly newer than the latest release.
- Default `--target` to the remote trunk branch. Pass another ref only when explicitly releasing it.
- Use `--notes-file` for more than a one-line note. With no notes, the script drafts a plain changelog
  from merged PRs/MRs.
- Pass `--repo <name|path>` when repo selection is ambiguous.

Fetch tags afterward only if the local checkout needs the new server-side tag.

# PR/MR management

Use the provider-neutral `pr.py` for an existing proposal:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py show <number|url>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py list [--limit N] [--branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py comment <number|url> <comment-id>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py update <number> [--title ...] [--description ...] [--target-branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py close <number>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply <number> <comment-id> '<body>'
```

Use `--repo <name|path>` when repository selection is ambiguous. `show` is a compact summary;
`comment` reads the full body, replies, diff location, and thread resolution.

Create proposals through [gcampr](commit-flow.md). Finding Verdicts and resolution belong to
[review](../../review/SKILL.md); a generic reply does not record a Verdict or resolve a thread.

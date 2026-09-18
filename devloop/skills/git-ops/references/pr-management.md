# PR/MR management

Use the provider-neutral `pr.py`; it selects GitHub or GitLab from the repo origin and resolves the
configured token. Do not hand-write provider API calls.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py show <number|url>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py comment <number|url> <comment-id> [--repo <name|path>]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py list [--limit N] [--branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py update <number> [--title ...] [--description ...] [--target-branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py close <number>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply <number> <comment-id> '<body>'
```

`pr show` is a compact summary. Use `pr comment` with a top-level ID from `pr show` or
`review findings` to read the full Markdown body, all replies, diff location, and resolution
reported by the Forge adapter. A missing ID or failed comment query returns a nonzero exit code.
This read does not record a Verdict or resolve the thread.

Invoke the CLI scripts directly; they locate their private Python modules without `PYTHONPATH`.
Do not replace these commands with `python -c` imports of `lib.forge`.

This CLI only inspects or manages an existing PR/MR and never mutates the working tree. Create a new
proposal through gcampr. ReviewRun/Finding/Verdict operations use the `review` skill and
`scripts/review.py`; generic `pr reply` has no review-domain side effects.

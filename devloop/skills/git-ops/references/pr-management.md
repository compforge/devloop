# PR/MR management

Use the provider-neutral `pr.py`; it selects GitHub or GitLab from the repo origin and resolves the
configured token. Do not hand-write provider API calls.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py show <number|url>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py list [--limit N] [--branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py update <number> [--title ...] [--description ...] [--target-branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py close <number>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py findings <number> [--pending]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply <number> <comment-id> '<body>'
```

This CLI only inspects or manages an existing PR/MR and never mutates the working tree. Create a new
proposal through gcampr. For `findings`/`reply` verdict discipline, use the `label-review` skill.

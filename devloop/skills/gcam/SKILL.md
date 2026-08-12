---
name: gcam
description: Commit current changes without pushing. Use when the user says "gcam" or wants to commit only.
---

Read the shared branch/mutation rules in [`git-ops`](../git-ops/SKILL.md) and the
[commit flow](../git-ops/references/commit-flow.md). Select the commit-only transaction:

Run:

```
bash <PLUGIN_ROOT>/scripts/smart_gcam.sh --message "<commit msg>" [--repo <name|path>] [--branch <name>] [--files <a,b,c>]
```

Trust the `PLAN:` banner. After committing, ask whether to push (`gcamp`) or open a PR/MR
(`gcampr`).

`<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

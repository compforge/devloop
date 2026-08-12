---
name: gcamp
description: Commit current changes and push, without creating a pull/merge request. Use when the user says "gcamp" or wants to commit + push (e.g. add a commit to an existing PR/MR branch).
---

Read the shared branch/mutation rules in [`git-ops`](../git-ops/SKILL.md) and the
[commit flow](../git-ops/references/commit-flow.md). Select the commit-and-push transaction:

Run:

```
bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh --message "<commit msg>" [--repo <name|path>] [--branch <name>] [--target <branch>] [--file <path>]...
```

This does not create a PR/MR. Trust the `PLAN:` banner.

`<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

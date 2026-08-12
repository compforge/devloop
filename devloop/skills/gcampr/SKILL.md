---
name: gcampr
description: Commit current changes, push, and create/reuse a pull/merge request (GitHub PR or GitLab MR). Use when the user says "gcampr" or asks to commit + push + open/raise a PR / MR / pull request / merge request.
---

Read the shared branch/mutation rules in [`git-ops`](../git-ops/SKILL.md) and the
[commit flow](../git-ops/references/commit-flow.md). Select the commit-push-and-open/reuse-PR
transaction:

```
bash <PLUGIN_ROOT>/scripts/smart_gcampr.sh --message-file <repo>/.devloop/commit_msg [--repo <name|path>] [--branch <name>] [--target <branch>] [--file <path>]... [--title "<PR title>"]
```

Trust the `PLAN:` banner and surface the returned PR/MR URL.
`<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

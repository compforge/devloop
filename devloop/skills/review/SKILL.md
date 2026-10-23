---
name: review
description: 'Manage devloop automated review runs and published GitHub/GitLab findings: inspect or run review, verify findings, record Verdicts, fix issues, resolve threads, or report missed findings. Use for surfaced Review context, review findings/comments, adjudication, or 打标. For direct code/architecture review without devloop artifacts, use code-taste.'
---

ReviewRun → Finding → Verdict → Handling → thread resolution.
A Verdict records validity/severity; it does not mean the issue is fixed or the thread resolved.

Use `<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py` below; `<PLUGIN_ROOT>` is
`${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex. The CLI owns Forge encoding
and durable Verdict replies; do not hand-write `ccr:label=` or edit local ground-truth datasets.

## Inspect or run

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py status
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py run [--background '<context>']
```

Lifecycle hooks already launch reviews. Do not duplicate a running run. Surfaced context is
advisory: report verified findings or incomplete coverage without taking over the current task.
An error or failed-file result is not clean; a stale run may need rerunning. Code changes require
a request to fix/process findings.

## Adjudicate and handle

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py findings <n|url> [--pending]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py comment <n|url> <comment-id>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py label <n> <comment-id> <verdict> --reason '<evidence>'
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py resolve <n> <comment-id> [--fixed]
```

Read the full finding and replies, then verify against the actual diff and execution path.
Only published, independently replyable Finding threads can receive Verdicts; local-only findings
and summary-note fallback text have no reply target.

| Verdict | Meaning |
|---|---|
| `important` | Valid, substantive defect |
| `minor` | Valid, small defect |
| `debatable` | Uncertain judgment or defensive suggestion |
| `wrong` | False positive, supported by counter-evidence |
| `repeat` | Same issue already delivered in an earlier comment on this PR/MR; cite it |

A behavior predating the diff is `wrong` with `#out-of-diff` attribution evidence.
An already fixed valid defect remains `important`/`minor`.

For `wrong`/`repeat`/`debatable`, record the reason and resolve without a code fix.
For `important`/`minor`, leave the thread open until an authorized fix is validated and published
through [git-ops](../git-ops/SKILL.md), then resolve with `--fixed`.

`--pending` means no Verdict. Empty pending output completes adjudication only. For a fix request,
also check all relevant findings and thread states: report published fixes, resolved threads,
and any valid issues still outstanding. Review never merges the proposal.

## Report a missed finding

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py missed <n> --path <file> --line <line> --reason '<evidence>'
```

---
name: validate
description: Normalize a repo Component, run its lint and test validation checks, and report each result. Use when the user asks to validate changes, lint/format code, run tests, or verify before committing or pushing.
---

For complete Component validation, run:

```
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py [<repo name|path>]
```

Validation has multiple checks, not modes. `make fix` is a normalize step: complete it first, then run
the read-only lint and test checks concurrently against the same stable content. A user may explicitly
request only one check; run `run_lint.py` for static quality or `run_tests.py` for behavior, and report
the result as partial validation rather than complete validation.

The scripts resolve the repo and affected Components, prepare dependencies, run canonical project
targets, and update each check's `.devloop` validation stamp. Project targets must follow the
[validation contract](references/spec.md). Read only the matching implementation guidance:
[Python](references/python.md), [Go](references/go.md), or [Node](references/node.md). Do not add tools,
dependencies, or Makefile targets unless requested.

Trust the output and report each check's pass/fail. Fix genuine source or test problems; never weaken
lint rules, suppress diagnostics, or loosen test assertions merely to force a green result. Only
`make fix` may perform automatic source rewrites.

`<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

---
name: validate
description: Normalize a repo Component, run its lint and test validation checks, and report each result. Use when the user asks to validate changes, lint/format code, run tests, or verify before committing or pushing.
---

Use automatic scope by default. Read the shared [repocli reference](../../references/repocli.md)
for direct CLI inspection, installation and analysis boundaries. Do not select or pass
`TEST_FILES` / `LINT_FILES` yourself unless the user explicitly requests an override.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_tests.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_lint.py <repo-or-component>
```

Normalization runs before one shared repocli analysis. The workflow selects affected files,
including dependent tests in other Components, and adapts paths to project Make contracts.
Unavailable, incompatible or uncertain analysis falls back to full checks with a Board reason.
An actual check failure stays a failure. Use `--full` when the user or project gate requires
full validation; do not repeat a full suite solely to replace a focused run's missing stamp.
Focused results do not authorize a later bare commit.

Validation consists of multiple checks. Run `make fix` normalization first, then read-only lint
and test checks may run concurrently against the same stable content. Running one check or a
focused selection is partial validation and must not be presented as complete Component validation.

The scripts resolve the repo and affected Components, prepare dependencies, run canonical project
targets, and update each check's `.devloop` validation stamp. Project targets must follow the
[validation contract](references/spec.md). Read only the matching implementation guidance:
[Python](references/python.md), [Go](references/go.md), or [Node](references/node.md). Do not add tools,
dependencies, or Makefile targets unless requested.

Trust the output and report each check's pass/fail. Fix genuine source or test problems; never weaken
lint rules, suppress diagnostics, or loosen test assertions merely to force a green result. Only
`make fix` may perform automatic source rewrites.

`<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

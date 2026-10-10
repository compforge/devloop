---
name: validate
description: Normalize a repo Component, run its lint and test validation checks, and report each result. Use when the user asks to validate changes, lint/format code, run tests, or verify before committing or pushing.
---

Validation is required; prioritize precise affected-file selection so lint and test process fewer files
and finish sooner. Expand scope when impact is uncertain or project contracts require it, while
preserving the required coverage.

Use automatic scope by default. Read the shared [repocli reference](../../references/repocli.md)
for direct CLI inspection, installation and analysis boundaries. Do not select or pass
`TEST_FILES` / `LINT_FILES` yourself unless the user explicitly requests an override.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_tests.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_lint.py <repo-or-component>
```

Normalization runs before one shared repocli analysis. Repocli identifies affected Components;
devloop chooses each selected Component's Makefile, then passes its owned `affectedFiles` / `testFiles`
as `LINT_FILES` / `TEST_FILES` when supported. Partial reports retain usable file selections and diagnostics.
Missing file-list contracts, unsafe/deleted inputs or no returned files for a selected Component run
that check in full. Components with incomplete impact are included conservatively, with the reason
shown on Board. Complete, unaffected Components are skipped. Unavailable or invalid
analysis falls back to all current Components; an explicit Component request retains its boundary.
An actual check failure stays a failure. `--full` bypasses automatic Component and file selection.

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

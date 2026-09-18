---
name: validate
description: Normalize a repo Component, run its lint and test validation checks, and report each result. Use when the user asks to validate changes, lint/format code, run tests, or verify before committing or pushing.
---

Choose validation scope from the change before running checks. Prefer the affected tests for
routine feedback: inspect the diff, changed behavior, callers and existing tests, then select the
relevant files, including tests that were not edited. Check that the Component Makefile consumes
`TEST_FILES`; paths must be relative to that Component. Target one Component explicitly when
passing file arguments in a multi-component repository.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_tests.py <component-path> -- "TEST_FILES=tests/a.test.ts tests/b.test.ts"
```

Without extra arguments, `run_tests.py` selects changed test files when the project supports it.
This does not infer which tests cover changed source. No usable selection or no Makefile contract
falls back to the full suite. Read the printed scope, reason and command; never pass `TEST_FILES=`
as boilerplate: an empty value requests the full suite.

Expand scope when dependencies or shared infrastructure make the impact uncertain, failures need
broader investigation, or the user/project gate requires full validation. After sufficient checks
pass, do not repeat a full suite merely to finish the turn or replace a missing full-validation stamp.
Honor required gates and report focused results as focused; they do not authorize a later bare commit.

```bash
# Full tests in the selected Components; cannot be combined with arguments after --.
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_tests.py <repo-or-component> --full

# Complete Component validation: normalize, then full lint and full tests.
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py <repo-or-component>
```

`run_lint.py` uses changed-file scope when the project explicitly supports `LINT_FILES` in its
Makefile. Pass `--full` only when full Component lint is needed. Focused lint does not stamp full
Component validation; projects without the contract retain full lint. TypeScript/Go checks may
require the project/package graph: do not narrow them by passing arbitrary source files.

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

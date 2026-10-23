---
name: validate
description: Run a repository or Component's managed lint/test validation and explain its scope and results. Use to validate changes, lint/format code, run tests, or verify before committing or pushing.
---

Use the entrypoint matching the requested checks. The scripts prepare dependencies, normalize with
`make fix` when available, and manage check execution and reuse.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_tests.py <repo-or-component>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_lint.py <repo-or-component>
```

`run_validate` runs lint and tests; the other entrypoints run only their named check.
`<PLUGIN_ROOT>` is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.

Repocli supplies impact facts; devloop owns Component/file selection, full-check fallback and reuse
under the project's validation contract. Use automatic scope by default; `--full` requests all
Components and full checks within the requested repo/Component boundary. Do not supply `TEST_FILES`
or `LINT_FILES` unless the user requests an override. A partial analysis can still supply usable
file selections; let the workflow decide rather than treating `partial` as a request for full tests.

Report the checked Components, focused/full scope, executed/reused results, and failures or skips.
Explain full-check or unavailable results from the reported reasons; do not infer unreported reuse
misses. A focused pass or a single check does not establish complete Component validation.

Read [the validation contract](references/spec.md) when diagnosing scope, reuse or project-target
behavior, and [repocli](../../references/repocli.md) when inspecting its analysis or compatibility.
When asked to add or change a project's validation targets, also read the relevant
[Python](references/python.md), [Go](references/go.md) or [Node](references/node.md) guidance.
Running validation alone does not authorize adding tools, dependencies or Makefile targets.

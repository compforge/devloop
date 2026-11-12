---
name: validate
description: Run a repository or Component's Makefile format/lint/test through repocli and explain its scope and results. Use to validate changes, format code, run tests, verify before committing or pushing, or diagnose past validation failures and slow checks.
---

Use repocli directly for project checks. The project owns its Makefile recipes;
repocli owns target discovery, file selection, execution, bounded concurrency and result reuse.
Read [repocli results and recovery](../../references/repocli.md#command-results-and-recovery)
before interpreting CLI output; use its supported CLI/schema baseline.

```bash
repocli format --repo <repo> --component <component>
repocli lint --repo <repo> --component <component>
repocli test --repo <repo> --component <component>
repocli validate --repo <repo> --base HEAD --check format,lint,test --timeout 10m --json
```

`validate` defaults to lint/test. `--check` selects the steps to combine. Format always runs
first; repocli replans from the resulting contents before running lint/test. Format can
change files and never grants validation evidence. `--plan` is read-only; when format is
selected, subsequent check commands are previews and must be replanned after format.

Use `--base` for automatic impact selection. Omit it for full checks within the selected
Component boundary; omit `--component` to include all discovered Components. A partial
analysis does not itself require full checks. Let repocli explain selection and fallback.
Use `--file` only for an explicit requested file scope; do not build Make arguments yourself.

Prepare project dependencies through its documented installation entrypoint before
validation. Missing Makefile targets are unavailable, not passing checks. Do not invent
targets, install tools, or change dependencies merely to make a validation command work.

Use `--json` for workflow decisions and `--output <file>` to retain the whole command result
in ignored local state, including failed rounds. The ValidationReport is in `data`; parse it
even when the process exits nonzero. `--plan` and `--history` also return envelopes by default;
neither provides evidence that checks ran in this invocation. Repocli checks its own history
before execution. `--force` requests real execution; `--concurrency` bounds simultaneous checks.
Do not assemble previous reports or decide execution reuse in the workflow.

Accept validation only after checking the command outcome plus `data.passed`, `data.complete`,
`data.inputsConsistent`, scope and individual check results. Report Components, focused/full
scope, executed/reused checks, failures and unavailable checks. Input inconsistency invalidates
passing evidence; a focused pass, format success or a single check does not prove full validation.
Report `cost.wallSeconds` and the slowest Component/check steps with their current execution
and lookup times. Use `cost.validation`, not historical reused check durations, for this round's cost.

For past failures or slow checks, use `repocli validate history list` to select a run,
then `repocli validate history show <runID>` for captured output, test timings and input evidence.
Read [history diagnosis](references/spec.md#history-diagnosis) for filtering and interpretation.
Query retained evidence before rerunning just to recover logs. Validate current changes normally;
historical success does not establish that the current inputs pass.

Read [the validation contract](references/spec.md) for result and Makefile semantics and
[repocli](../../references/repocli.md) for installation and repository analysis.

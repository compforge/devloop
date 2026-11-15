---
name: validate
description: Guide project Makefile format/lint/test contracts, run checks through repocli, and tune slow validation from execution evidence. Use to set up or improve validation targets, validate changes, format code, run tests, verify before publishing, or diagnose failed and slow checks.
---

Use repocli directly for project checks. The project owns its Makefile recipes;
repocli owns target discovery, file selection, execution, bounded concurrency and result reuse.
Read [repocli results and recovery](../../references/repocli.md#command-results-and-recovery)
before interpreting CLI output; use its supported CLI/schema baseline.

## Project Makefile guidance

For a new project or a request to improve validation, inspect existing Makefiles, pinned tools,
configuration and project instructions before proposing changes. Reuse its runners and installation
entrypoints. Read [the contract](references/spec.md) and only the relevant language guidance:
[Go](references/go.md), [Python](references/python.md), or [Node](references/node.md).

Guide the project toward literal `format`, `lint` and `test` targets: format normalizes source;
lint/test remain read-only and non-interactive. Recommend optional `LINT_FILES` / `TEST_FILES`
support where language semantics permit, with empty values retaining full checks. For parallelizable
checks, recommend overridable positive `LINT_WORKERS` / `TEST_WORKERS` defaults mapped to native
runner capacity. Missing worker controls are an improvement opportunity, not a failing check.
Explain the concrete gap and suggested recipe; make changes when the task authorizes them.
Do not add dependencies or targets merely to make an execution request pass.

## Run and tune validation

Start with project defaults. Inspect a Makefile's capabilities when entering a project or when the
report exposes full-scope fallback or slow checks; do not repeat an onboarding audit on every run.

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

When actual execution is slow, locate the expensive phase/check before changing parameters.
Use `--lint-workers N` / `--test-workers N` to override the corresponding Makefile budget;
these are separate from outer `--concurrency`. Check installed command help before using the
worker flags (repocli 0.89.0+). A flag cannot accelerate a recipe that does not consume its variable;
recommend the project change instead. Follow [capacity tuning](references/spec.md#capacity-tuning)
to adjust one budget at a time and compare real execution at the same scope.

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

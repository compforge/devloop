---
name: validate
description: Run a repository or Component's Makefile format/lint/test through repocli and explain its scope and results. Use to validate changes, format code, run tests, or verify before committing or pushing.
---

Use repocli directly for project checks. The project owns its Makefile recipes;
repocli owns target discovery, file selection, execution, bounded concurrency and result reuse.

```bash
repocli format --repo <repo> --component <component>
repocli lint --repo <repo> --component <component>
repocli test --repo <repo> --component <component>
repocli validate --repo <repo> --base HEAD --check format,lint,test --timeout 10m
```

`validate` defaults to lint/test. `--check` selects the steps to combine. Fix always runs
first; repocli replans from the resulting contents before running lint/test. Fix can
change files and never grants validation evidence. `--plan` is read-only; when format is
selected, subsequent check commands are previews and must be replanned after format.

Use `--base` for automatic impact selection. Omit it for full checks within the selected
Component boundary; omit `--component` to include all discovered Components. A partial
analysis does not itself require full checks. Let repocli explain selection and fallback.
Use `--file` only for an explicit requested file scope; do not build Make arguments yourself.

Prepare project dependencies through its documented installation entrypoint before
validation. Missing Makefile targets are unavailable, not passing checks. Do not invent
targets, install tools, or change dependencies merely to make a validation command work.

For machine-readable results use `--json`; `--output <file>` saves the same report,
including failed rounds. `--reuse <previous-report>` asks repocli to check reuse eligibility;
never infer it from a timestamp or fingerprint alone. Reports may include project output;
keep them in ignored local state. `--concurrency` bounds simultaneous checks.

When branch evidence, managed dependency preparation or lifecycle gates are needed, use
the development workflow adapter shared by gcam/gcamp/gcampr:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/run_validate.py <repo-or-component>
# --check lint / --check test selects one check; --full bypasses impact selection.
```

`<PLUGIN_ROOT>` is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.
The adapter submits one repocli round, stores the original report and associates it with
the branch. It does not implement a second validation engine.

Report Components, focused/full scope, executed/reused checks, failures and unavailable
checks. `inputsConsistent: false` invalidates passing evidence independently of check
availability. A focused pass, format success or a single check does not prove full validation.

Read [the validation contract](references/spec.md) for result and Makefile semantics and
[repocli](../../references/repocli.md) for installation and repository analysis.

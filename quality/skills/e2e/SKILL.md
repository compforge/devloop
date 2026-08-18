---
name: e2e
description: Discover, run, and interpret an existing project's end-to-end tests. Use when the user asks to run, check, inspect, or report E2E tests; validate a project or deployed environment end to end; or determine whether a project has an executable E2E capability. Follow project-owned E2E code and operating knowledge, use case-harness primitives only when the project already integrates them, and never invent missing tests.
---

# E2E Quality

Evaluate the project's existing E2E capability. Trigger and interpret tests; do not author tests,
fix failures, or substitute source review for execution evidence.

## Keep the three owners separate

1. Treat case-harness or another framework as infrastructure that may provide runners, lifecycle,
   assertions, evidence, and verdict primitives.
2. Treat the business project's E2E code, cases, fixtures, adapters, and acceptance criteria as the
   executable verification asset.
3. Treat instructions and runbooks beside that E2E code as the source of project-specific operating
   knowledge, including environment setup, known failure modes, retries, cleanup, and evidence paths.

Do not assume that installing or importing case-harness means the project has a runnable E2E suite.
Do not bypass a project wrapper to invoke a lower-level framework directly.

## Understand the project

1. Resolve the repository or project root from the user's target.
2. Follow the project's AGENTS.md discovery rules, then read its README.
3. Establish what the project does, which user or API boundary its E2E suite exercises, and which
   revision and environment the requested run should evaluate.

Do not require a diff or a dedicated quality declaration. Use the repository's current facts.

## Discover the E2E capability

Search the repository before running anything:

- Locate likely E2E, acceptance, integration, system-test, or product-test directories.
- Inspect nearby AGENTS.md, README, runbooks, Makefiles, package scripts, configuration, fixtures,
  and recent result artifacts.
- Search for documented E2E commands and framework entrypoints, including project-local wrappers
  around case-harness, Playwright, Cypress, pytest, or other runners.
- Prefer the business-facing suite and its canonical command when multiple lower-level runners
  exist.

For the selected E2E directory, read its local documentation and configuration before execution.
Project-local knowledge takes precedence over generic framework habits.

Classify discovery as one of:

- `ready`: an executable suite, target, and required inputs are available;
- `blocked`: the suite exists but a required environment, credential, dependency, service, device,
  or target is unavailable;
- `no_capability`: no executable project-owned E2E suite can be found.

Framework code without business tests is `no_capability`, not `ready`. If more than one plausible
suite remains and repository evidence cannot select one, report the ambiguity instead of guessing.

## Execute the project-owned entrypoint

1. Use the command documented by the project or exposed through its canonical Make/package/CLI
   entrypoint.
2. Preserve the requested revision and environment. Do not deploy, install new dependencies, create
   credentials, or switch to a different target unless the user explicitly authorizes it.
3. Respect project-declared timeouts, concurrency, cleanup, and retry policy. Do not retry a failure
   merely to obtain a green run; only apply retries already defined by the suite or its runbook.
4. Capture the exact command, exit status, native verdict, logs, screenshots, traces, reports, and
   other evidence paths produced by the suite.

Do not edit source, cases, assertions, configuration, or expected results during the assessment.
When execution would have material impact on a shared or production environment, stop for the
required authorization before running it.

## Interpret the evidence

Use the suite's native result semantics. When case-harness artifacts exist, consume their Run,
Verdict, checks, and evidence without flattening `skipped` or `error` into pass.

Distinguish these outcomes:

- `passed`: the selected suite completed and its declared checks passed;
- `failed`: the suite completed and a business assertion or acceptance condition failed;
- `error`: the runner, setup, cleanup, environment, or evidence collection failed;
- `blocked`: execution could not start or complete because a prerequisite was unavailable;
- `no_capability`: no runnable project-owned E2E suite was discovered.

Inspect available failure artifacts to explain what failed, but do not diagnose beyond the evidence
or turn a plausible cause into a confirmed root cause.

## Report and preserve learnings

Report:

- the project, revision, environment, and E2E boundary evaluated;
- the E2E directory and canonical entrypoint discovered;
- the exact capability and command executed;
- the outcome and the evidence supporting it;
- failed checks, execution errors, blocked prerequisites, and untested or unknown areas;
- reusable project-specific operating knowledge observed during the run.

Do not silently modify the project's E2E documentation while assessing it. When a repeatable setup
issue, workaround, cleanup rule, or evidence location should be retained, propose a concise update
beside the project's E2E code and apply it only when the user asks. Promote a lesson into this skill
only after it proves reusable across projects.

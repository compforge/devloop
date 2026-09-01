---
name: e2e
description: Discover, operate, and incrementally extend a project's existing end-to-end test capability. Use when the user asks to run, check, inspect, or report E2E tests; validate a project or deployed environment end to end; identify E2E coverage gaps; or add and strengthen project-owned E2E cases. Follow project-owned tests, operating knowledge, and canonical entrypoints; do not create a parallel test system or present unexecuted coverage as verified.
---

# E2E Quality

Operate the project's existing E2E capability and help it grow toward comprehensive coverage over
time. Start from project-owned tests, fixtures, conventions, and entrypoints. Assessment is
read-only; when the user explicitly asks to add or fix coverage, change the project's E2E assets
under its development rules and validate them through the canonical entrypoint. Comprehensive
coverage is the long-term direction, not a requirement to close every gap in one task.

## Keep the owners separate

1. Treat case-harness or another framework as infrastructure that may provide runners, lifecycle,
   assertions, evidence, and verdict primitives.
2. Treat the project as owner of its E2E cases, fixtures, adapters, acceptance criteria, canonical
   commands, and operating notes for environments, retries, cleanup, and evidence.
3. Treat this skill as the operator that discovers and runs those assets, interprets their evidence,
   exposes remaining coverage, and helps add bounded project-owned cases when requested.

Do not call a lower-level framework directly when the project exposes a wrapper. Framework code
without runnable project-owned tests is `no_capability`, not an executable E2E suite.

## Discover and select

Read the project's AGENTS.md and README first, then locate:

- the business or system boundary the project intends E2E to verify;
- E2E, acceptance, integration, or system-test directories and their nearest operating notes;
- the canonical command, exact case registry or listing mechanism, configuration, fixtures, and
  recent result artifacts;
- the runner revision and the identity of the system under test, including the requested target or
  environment, where the runner executes, and how it reaches that target;
- project-declared prerequisites, material execution conditions, side effects, cleanup, and
  available evidence;
- existing coverage relevant to the user's goal and the smallest sufficient case selection.

Prefer the business-facing suite when several lower-level runners exist. Resolve exact selectors
from project registries, listing commands, or documentation instead of guessing them. Project-local
knowledge takes precedence over generic framework habits.

Classify discovery as:

- `ready`: an executable suite, selected cases, required inputs, and a verified connection from the
  runner to the intended target are available;
- `blocked`: the suite exists but a required target, credential, dependency, service, device, or
  other prerequisite is unavailable;
- `no_capability`: no executable project-owned E2E suite can be found.

Report ambiguity when multiple plausible suites or targets remain. Do not turn framework presence,
source review, or a compile-only check into execution evidence.

## Prepare and control the environment

Before a live run, read the shared
[Environment contract](../../references/environment.md) completely. It defines local and remote
Targets, Runner-to-Target data-plane readiness, preparation kinds, authorization, lifecycle,
cleanup, and evidence.

First fix the Target environment and subject revision; only then select the Runner and use the first
applicable authorized Connection in the contract's priority order. For a local Runner reaching
Kubernetes, that normally means a run-owned port-forward when the network path is not itself under
test, with readiness, logs, and cleanup owned by the run.

When using a direct Kubernetes Service endpoint instead, follow the contract's IP-first selection,
preserve required logical service authority, and do not bypass Service DNS when name resolution is
part of the E2E behavior being verified.

When selected cases require fixtures, temporary conditions, fault injection, chaos experiments, or
restoration, also read
[E2E scenario preparation](references/scenario-environment.md) completely. Use project-owned setup and
cleanup mechanisms, verify prepared conditions from observable state, and keep effects within the
authorized Target and blast radius.

## Run and interpret

Use the project-owned entrypoint and preserve the requested runner revision, system-under-test
identity, target, and execution policy. Run the smallest sufficient selection by default; use a full
suite only when the user, a project gate, or the affected boundary requires it.

- Respect project-declared timeouts, concurrency, cleanup, and retry policy. Do not retry a failure
  merely to obtain a green run.
- Do not deploy, install dependencies, create credentials, switch targets, or make other material
  environment changes unless the user authorizes them.
- Capture the exact command, exit status, native verdict, and relevant logs, screenshots, traces,
  reports, cleanup outcomes, or other project-declared evidence.
- Treat target-connection failures as environment `error` or `blocked`, not product assertion failures.
  If a verified alternate connection path is used, preserve the first error and report the rerun as
  execution under a changed Environment rather than silently retrying for green.
- Use native result semantics. Keep `passed`, `failed`, `skipped`, `error`, `blocked`, and
  `no_capability` distinct; an online case that skipped is not a live pass.
- Separate verdict from coverage. `passed` means the executed assertions passed under the realized
  conditions; skipped, gated, unselected, or unknown areas remain unverified.

Coverage dimensions come from project-owned tests, capability probes, and runbooks. Do not hard-code
product, infrastructure, or framework-specific dimensions into this generic skill. Inspect failure
evidence to explain what failed, but do not turn a plausible cause into a confirmed root cause.

When execution would materially affect a shared or production environment, obtain the required
authorization before running it.

## Grow coverage deliberately

When the user asks to add or strengthen E2E coverage:

1. Map the relevant existing cases and choose one bounded uncovered behavior or regression risk.
2. Reuse the project's framework integration, fixtures, lifecycle, naming, registry, and assertion
   style; improve a shared harness only when the project already owns that integration and the need
   is genuinely reusable.
3. Add the case at the business or system boundary that proves the behavior. Do not substitute a
   lower-level test merely because it is easier to write.
4. Run the new case, the nearest relevant regression set, and any project-owned registration or
   coverage gate.
5. Report the coverage gained and the important gaps that remain. Move toward comprehensive project
   coverage incrementally instead of expanding one task into an unbounded test program.

If the user asks only for assessment, keep the run read-only and propose the next coverage gap
instead of mutating tests. Do not weaken assertions or expected outcomes just to match current
behavior.

## Report and retain learning

Lead with the decision-relevant result, then report:

- the project, runner revision, system-under-test identity, target, and E2E boundary;
- the runner location, target connection path, and application-level connectivity evidence;
- the prepared Environment, fault or chaos conditions, and readiness evidence relevant to the verdict;
- the canonical entrypoint and exact cases executed;
- the native verdict and supporting evidence;
- executed, skipped, gated, unselected, and unknown or unverified areas;
- cases added or strengthened, the coverage gained, and remaining gaps when the task changed tests;
- execution errors, blocked prerequisites, side effects, and cleanup outcomes;
- reusable project-specific operating knowledge observed during the work.

Persist run-specific evidence and project-specific lessons beside the project's E2E assets. Promote
an operating pattern into this skill only after it proves reusable across projects. Do not copy
private data, credentials, volatile environment facts, or project-only commands into the plugin.

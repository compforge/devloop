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

Read [Quality concepts](../../CONCEPTS.md) before discovery or interpretation. It defines ownership,
subject identity, execution facts, evaluation, comparison, and result states shared by the skills.

The project owns E2E Cases, fixtures, adapters, acceptance criteria, canonical commands, and
operating notes. Preserve its test grouping and call evidence: a CaseRun may contain several
OperationRuns. Framework code without runnable project-owned tests cannot establish live coverage.

## Discover and select

Read the project's AGENTS.md and README first, then locate:

- the business or system boundary the project intends E2E to verify;
- E2E, acceptance, integration, or system-test directories and their nearest operating notes;
- the canonical command, exact case registry or listing mechanism, configuration, fixtures, and
  recent result artifacts;
- the test-process revision and the identity of the system under test, including the requested target or
  environment, where the runner executes, and how it reaches that target;
- project-declared prerequisites, material execution conditions, side effects, cleanup, and
  available evidence;
- existing coverage relevant to the user's goal and the smallest sufficient case selection.

Prefer the business-facing suite when several lower-level runners exist. Resolve exact selectors
from project registries, listing commands, or documentation instead of guessing them. Project-local
knowledge takes precedence over generic framework habits.

Classify the requested action as `ready`, `blocked`, or `no_capability` using the shared concepts.
A live suite requires selected cases, inputs, prerequisites, and verified application connectivity.
Existing result artifacts can support an offline report without a reachable target.

Report ambiguity when multiple plausible suites or targets remain. Do not turn framework presence,
source review, or a compile-only check into execution evidence.

## Prepare and control the environment

Before a live run, read [environment preparation](../../references/environment.md) completely.
Resolve the target Service, Environment, and deployed revision first, then the test-process location
and application connection. Follow the shared connection selection and readiness checks.

When selected cases require fixtures, temporary conditions, fault injection, chaos experiments, or
restoration, also read
[E2E scenario preparation](references/scenario-environment.md) completely. Use project-owned setup and
cleanup mechanisms, verify prepared conditions from observable state, and keep effects within the
authorized Target and blast radius.

## Run and interpret

Use the project-owned entrypoint and preserve the requested test-process revision, system-under-test
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
  execution under changed run conditions rather than silently retrying for green.
- Preserve native verdict states such as `passed`, `failed`, `skipped`, and `error`, separately
  from capability discovery states. An online case that skipped is not a live pass.
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

- the project, test-process revision, system-under-test identity, target, and E2E boundary;
- the execution location, target connection path, and application-level connectivity evidence;
- the prepared run conditions, fault or chaos controls, and readiness evidence relevant to the verdict;
- the canonical entrypoint and exact cases executed;
- the native verdict and supporting evidence;
- executed, skipped, gated, unselected, and unknown or unverified areas;
- cases added or strengthened, the coverage gained, and remaining gaps when the task changed tests;
- execution errors, blocked prerequisites, side effects, and cleanup outcomes;
- reusable project-specific operating knowledge observed during the work.

Persist evidence and reusable operating knowledge beside the project's E2E assets under the shared
provenance and privacy rules. Promote an operating pattern into this skill only after it proves
reusable across projects.

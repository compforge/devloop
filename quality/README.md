# Quality

Quality is a skill-only plugin that helps coding agents operate project-owned quality capabilities.
It does not ship test suites, evaluation datasets, or business judgment criteria, and it does not
replace the frameworks and project assets that make verification executable.

The bundled skills currently cover three independent quality views:

- `e2e` operates a project's existing end-to-end capability and incrementally adds project-owned
  coverage when requested;
- `perf` operates and compares project-owned load, capacity, stress, and soak experiments, and can
  incrementally add bounded performance coverage when requested;
- `trajectory` evaluates agent decisions and actions, compares effect and cost, finds the next
  evidence-backed problem, and organizes controlled tuning experiments.

Each skill connects three layers without merging their ownership:

1. a framework such as case-harness may provide reusable execution, load, evaluation, measurement,
   artifact, and reporting primitives;
2. each project owns its real cases, workloads, profiles, recordings, adapters, labels, Evaluators,
   Measurers, acceptance criteria, and canonical entrypoints;
3. the skill discovers and operates that project capability, interprets its evidence, helps evolve
   project-owned assets when requested, and preserves project-specific knowledge beside them.

During assessment, if no runnable project-owned capability exists, a skill returns `no_capability`
rather than inventing tests or evaluations, or presenting source review as execution evidence.
Explicit coverage work may evolve an existing project-owned capability; it does not make an absent
suite look executable.

## Operating model

The skills share a small quality loop while preserving each domain's native semantics:

```text
understand the target and runner path
  → discover project-owned capability
  → gate on executability
  → run the canonical entrypoint
  → interpret native evidence
  → report conclusions and unknowns
  → retain reusable operating knowledge
```

E2E and performance execution share one target-confirmation boundary: identify the system under
test and revision, decide whether it is local or remote, locate the runner, and verify the
application data-plane path between them. Kubernetes API access or a configured endpoint is not by
itself target readiness. Each skill then adds its own preparation: E2E prepares cases, fixtures,
and scenario controls; performance additionally prepares the resource profile, load generator,
dependency capacity, observations, safety limits, and cooldown.

Execution facts, judgments, and missing evidence remain distinct. A failed assertion is not a
runner error; an unavailable capability is not a pass; a useful analysis is not automatically a
release verdict. Skills may organize evidence and propose the next experiment, but they do not
claim causality or mutate the evaluated system unless the user asks.

## Skills first, orchestration later

Quality intentionally starts at the skill layer. E2E, performance, trajectory, and other quality
views should first mature as independent operators with clear inputs, evidence, outcomes, and
ownership. This keeps real project workflows visible while their common shape is still emerging.

Only after several skills demonstrate stable contracts and repeated composition needs might an
agent- or orchestration-level Quality Harness coordinate them. That is a future consumer of these
skills, not a dependency or implementation goal of this plugin today.

## Install

Add the devloop marketplace once, then install the plugin.

Claude Code:

```text
/plugin marketplace add https://github.com/compforge/devloop.git
/plugin install quality@devloop
```

Codex:

```bash
codex plugin marketplace add https://github.com/compforge/devloop.git
codex plugin add quality@devloop
```

Start a new session after installation so the agent can discover the bundled skill.

## Use

Ask for the outcome instead of naming a framework command:

```text
Run this project's E2E tests and report the result.
Check whether the test environment passes E2E.
Find and execute the existing E2E capability; tell me if the project has none.
Add one bounded E2E case for this regression and run the nearest relevant checks.
Run the project's smallest capacity profile and report the trustworthy limit and caveats.
Compare the latest performance run with its declared baseline without generating load again.
Add one bounded soak or scaling profile using the project's existing workload adapter.
Evaluate this project's agent trajectories and compare effect and cost with the baseline.
Find the next trajectory problem worth optimizing.
For this high-token trajectory problem, identify likely causes and controlled experiments.
```

The skills operate existing project-owned quality assets. Assessment does not invent missing tests,
workloads, profiles, recordings, labels, or evaluators. When the user asks to grow coverage, changes
remain in the project-owned capability and move toward broader coverage incrementally. The skills do
not deploy environments without authorization, modify agent behavior unless asked, or turn
unavailable coverage into a pass.

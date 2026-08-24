# Quality

Quality is a skill-only plugin that helps coding agents operate project-owned quality capabilities.
It does not ship test suites, evaluation datasets, or business judgment criteria, and it does not
replace the frameworks and project assets that make verification executable.

The bundled skills currently cover two independent quality views:

- `e2e` discovers, runs, and interprets a project's existing end-to-end tests;
- `trajectory` evaluates agent decisions and actions, compares effect and cost, finds the next
  evidence-backed problem, and organizes controlled tuning experiments.

Each skill connects three layers without merging their ownership:

1. a framework such as case-harness may provide reusable execution, evaluation, measurement,
   artifact, and reporting primitives;
2. each project owns its real cases or recordings, adapters, labels, Evaluators, Measurers,
   acceptance criteria, and canonical entrypoints;
3. the skill discovers and operates that project capability, interprets its evidence, and preserves
   project-specific knowledge beside the assets that need it.

If no runnable project-owned capability exists, a skill returns `no_capability` rather than
inventing tests or evaluations, or presenting source review as execution evidence.

## Operating model

The skills share a small quality loop while preserving each domain's native semantics:

```text
understand the target
  → discover project-owned capability
  → gate on executability
  → run the canonical entrypoint
  → interpret native evidence
  → report conclusions and unknowns
  → retain reusable operating knowledge
```

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
Evaluate this project's agent trajectories and compare effect and cost with the baseline.
Find the next trajectory problem worth optimizing.
For this high-token trajectory problem, identify likely causes and controlled experiments.
```

The skills operate existing project-owned quality assets. They do not invent missing tests,
recordings, labels, or evaluators; deploy environments without authorization; modify agent behavior
unless asked; or turn unavailable coverage into a pass.

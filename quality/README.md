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

The project owns the tests, profiles, recordings, adapters, and judgment criteria. A framework
such as quality-harness supplies execution and analysis mechanisms; these skills discover and
operate the project's canonical entrypoints, interpret evidence, and preserve useful operating
knowledge beside the project assets.

## Operating model

The skills share [Quality concepts](CONCEPTS.md): subject and environment identity, execution
facts, evidence and evaluation, comparison, and the distinction between capability, execution
health, and quality decisions. Each skill retains its domain's lifecycle and judgment rules.

```text
identify the question and subject
  → discover a project capability or sufficient recorded evidence
  → prepare live execution or select existing evidence
  → use the canonical entrypoint
  → interpret results and coverage
  → report the conclusion and next supported action
```

Live E2E and performance runs follow [environment preparation](references/environment.md): select
the target and revision, locate the test process, verify application connectivity, prepare
conditions, and retain cleanup evidence. Offline analysis reuses recorded facts without requiring
a live target. No usable capability or sufficient evidence is reported as `no_capability`;
an unavailable prerequisite is `blocked`.

Execution facts and judgment remain separate. A passed assertion or SLO covers only its realized
conditions; missing observations, skipped checks, and execution errors remain visible. Skills
can propose the next experiment or improve project-owned assets when requested. They neither
invent a missing suite nor supply cross-skill execution orchestration.

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
load profiles, recordings, labels, or judgment components. When the user asks to grow coverage, changes
remain in the project-owned capability and move toward broader coverage incrementally. The skills do
not deploy environments without authorization, modify agent behavior unless asked, or turn
unavailable coverage into a pass.

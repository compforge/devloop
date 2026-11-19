---
name: perf
description: Discover, run, interpret, compare, and incrementally extend a project's existing system performance capability. Use when the user asks to run or report load, capacity, stress, soak, or performance-regression tests; compare performance runs; or add bounded project-owned perf coverage. Follow project-owned workloads, profiles, targets, and entrypoints; do not invent a missing capability or run material load without target authorization.
---

# Performance Quality

Assess how a system behaves under declared resources and load. Operate the project's performance
capability and explain the capacity, latency, resource use, and limitations supported by its facts.

Read [Quality concepts](../../CONCEPTS.md) before discovery or interpretation. It defines ownership,
subject identity, execution facts, evaluation, comparison, and result states shared by the skills.

The project owns its Cases, protocol Runners, Judges, resource/load profiles, Probes, safety
limits, baselines and any explicitly supplied acceptance criteria. A perf Runner invokes a service protocol; Workload identifies a Service's
platform carrier. Record where the load generator executes separately from both.

## Choose the workflow

- **Run a load test.** Select the project's Case mix and profile using [load.md](references/load.md).
  Follow [run.md](references/run.md) to verify the target and generator, show the effective configuration,
  obtain confirmation, execute the run, and verify recovery.
- **Interpret or compare saved runs.** Start with the artifacts and [load.md](references/load.md).
  Establish the actual inflight load, measurement window, and request population before interpreting
  latency or throughput. Existing artifacts support offline analysis.
- **Diagnose a bottleneck.** Establish the pressure during the selected window from observed inflight.
  From the entry Operation, follow the [call graph](references/callgraph.md) and compare each Operation's
  rate, errors, and duration (RED). Check the owning Service's [resource usage](references/resources.md)
  during the same window. Use traces, logs, or a controlled comparison to test a candidate explanation.

## Discover the project's capability

Use the project's AGENTS.md and README to find the canonical entrypoint, Cases, protocol Runner,
completion signals and Judge, resource/load profiles, observation declarations, and saved artifacts.
Classify the requested action as `ready`, `blocked`, or `no_capability` using the shared concepts.
For live load, choose the smallest existing profile that answers the requested question, preserving
the scope of a capacity scan or soak test. Resolve the target and profile before execution.

## Grow coverage deliberately

When the user asks to add or strengthen performance coverage:

1. Map existing Cases, adapters, profiles, observations, and baselines; choose one missing question.
2. Keep stable input and expected behavior in project Case assets. Select case weights, resources,
   and load phases in the Experiment/Profile.
3. Capture protocol facts in the Runner and resource facts in Probes. Implement per-request
   judgment independently; keep measurements separate from business acceptance.
4. Validate configuration and adapter behavior offline, then run the smallest relevant live
   experiment when its target and impact are authorized.
5. Preserve meaningful windows and thresholds. Missing observations need explanation or repair,
   not deletion to make a profile pass.

Reuse project lifecycle and clients. Improve a shared harness only for a reusable mechanism;
project protocols, endpoints, credentials, budgets, and thresholds stay in the project.

## Report and retain learning

Lead with the supported performance conclusion. Include target and generator revisions, execution
location and connection, exact command, realized resource/load/case mix, phase boundaries, stop
and cleanup state, native Verdict, observation coverage, key request/resource facts, comparison conditions,
and artifact paths. State the observed limit separately from any extrapolation and its assumptions.

Persist evidence and reusable operating knowledge beside the project's perf assets under the
shared provenance and privacy rules.

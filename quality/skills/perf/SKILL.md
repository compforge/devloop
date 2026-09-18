---
name: perf
description: Discover, run, interpret, compare, and incrementally extend a project's existing system performance capability. Use when the user asks to run or report load, capacity, stress, soak, or performance-regression tests; compare performance runs; or add bounded project-owned perf coverage. Follow project-owned workloads, profiles, SLOs, targets, and entrypoints; do not invent a missing capability or run material load without target authorization.
---

# Performance Quality

Assess how a system behaves under declared resources and load. Operate the project's performance
capability and explain the capacity, latency, resource use, and limitations supported by its facts.

Read [Quality concepts](../../CONCEPTS.md) before discovery or interpretation. It defines ownership,
subject identity, execution facts, evaluation, comparison, and result states shared by the skills.

The project owns its Cases, protocol Runners, Judges, resource/load profiles, Probes, SLOs, safety
limits, and baselines. A perf Runner invokes a service protocol; Workload identifies a Service's
platform carrier. Record where the load generator executes separately from both.

## Discover and select

Read the project's AGENTS.md and README, then locate:

- the canonical performance, capacity, stress, soak, or regression commands and operating notes;
- the target Service, Environment, deployed revision, Workloads, load-generator location, and
  application connection path;
- Cases or stimuli, case mix, protocol Runner, raw completion signals, and independent Judge;
- named experiments and resource/load profiles, both request rate and maximum inflight limits,
  phase schedules, duration, arrival distribution, and request/time budgets;
- Probes, SLOs, breakers, stop/cancellation behavior, cooldown, cleanup, and target authorization;
- native run schema, raw requests and resource observations, evaluation records, reports, and
  comparison baselines.

Classify the requested action as `ready`, `blocked`, or `no_capability` using the shared concepts.
An executable load test requires a project-owned adapter, runnable profile, and verified target
connection. Existing artifacts can support offline analysis without a reachable target.

Choose the smallest existing profile that answers the question. Preserve a requested capacity scan
or soak test's scope; a smoke run cannot stand in for it. Resolve ambiguity from project evidence
and ask when the intended profile or target remains unclear.

## Prepare and run

Before live load or target changes, read [environment preparation](../../references/environment.md)
and [load-environment preparation](references/load-environment.md) completely. Resolve the target,
then execution location and connection, then load-generator capacity, dependency quotas, fresh
observations, steady state, safety limits, and cleanup.

Before selecting or interpreting load, read [load and evidence](references/load-and-evidence.md)
completely. Use the project's actual scheduling contract: inspect what happens at the inflight
limit, how phases end, and which events determine windows and statistics.

Use the canonical entrypoint and native lifecycle. Preserve the requested revision, resource
envelope, load, case mix, and SLO policy. Record the exact command and realized configuration;
respect warmup, hold, cooldown, breaker, stop, cancellation, and cleanup behavior. Do not edit a
profile during measurement or retry a failed run only to obtain green output.

Deploying, installing dependencies, creating credentials, resizing resources, switching targets,
or generating material load requires authorization covering that action and target. Record changed
execution conditions and preserve the first failure when an alternate connection is used.

Capture the native execution model, raw requests and resource samples, independent evaluations,
Verdict, report, logs, traces, and cleanup evidence. Use persisted facts for supported offline
judgment, SLO recomputation, or report rendering; changing a judgment is not a reason to generate
load again. A Judge error must remain visible even when a completed Outcome is available.

## Validate and interpret

Check data health before drawing a performance conclusion:

1. Verify the target and revision, resources, both load axes, case mix, and realized phase windows.
2. Check stop reasons, completed samples, missing judgments, drops, interruptions, inflight state,
   time limited by the inflight cap, Probe errors, missing series, and skipped SLOs.
3. Distinguish configured rate, actual dispatch rate, and completion throughput. No drops does not
   prove the configured rate was sustained. Read scheduling and coordinated-omission caveats.
4. Align request and resource windows. Interpret latency by the native request cohort and
   throughput by actual completion events; inspect warmup, hold, and cooldown separately.
5. Confirm capacity only from complete stable-load windows with sufficient requests and passing
   applicable SLOs. A finite-rate window blocked by its inflight cap cannot confirm that rate's
   capacity; use the native eligibility rules in the evidence reference.
6. Compare within a declared scan axis while holding the other axis, resources, scheduling shape,
   and execution conditions fixed. Separate incomparable points instead of fitting one curve.

A passed SLO supports its declared gate under the realized experiment. It does not establish
untested capacity or a root cause. Correlate latency, throughput, errors, saturation, resources,
restarts, and scaling; use profiling or trace evidence for causal investigation.

Preserve useful completed windows after later failures while reporting the run's error or cleanup
state. Keep missing evidence, interrupted measurement, and skipped gates visible.

## Grow coverage deliberately

When the user asks to add or strengthen performance coverage:

1. Map existing Cases, adapters, profiles, observations, and baselines; choose one missing question.
2. Keep stable input and expected behavior in project Case assets. Select case weights, resources,
   load phases, and SLOs in the Experiment/Profile.
3. Capture protocol facts in the Runner and resource facts in Probes. Implement per-request
   judgment independently; make observations affect pass/fail through explicit project SLOs.
4. Validate configuration and adapter behavior offline, then run the smallest relevant live
   experiment when its target and impact are authorized.
5. Preserve meaningful windows and thresholds. Missing observations need explanation or repair,
   not deletion to make a profile pass.

Reuse project lifecycle and clients. Improve a shared harness only for a reusable mechanism;
project protocols, endpoints, credentials, budgets, and thresholds stay in the project.

## Report and retain learning

Lead with the supported performance conclusion. Include target and generator revisions, execution
location and connection, exact command, realized resource/load/case mix, phase boundaries, stop
and cleanup state, native Verdict, SLO coverage, key request/resource facts, comparison conditions,
and artifact paths. State the observed limit separately from any extrapolation and its assumptions.

Persist evidence and reusable operating knowledge beside the project's perf assets under the
shared provenance and privacy rules.

---
name: perf
description: Discover, run, interpret, compare, and incrementally extend a project's existing system performance capability. Use when the user asks to run or report load, capacity, stress, soak, or performance-regression tests; compare performance runs; or add bounded project-owned perf coverage. Follow project-owned workloads, profiles, SLOs, targets, and entrypoints; do not invent a missing capability or run material load without target authorization.
---

# Performance Quality

Assess how a deployed system behaves under a declared resource profile and load. Operate the
project's existing performance capability; do not replace its load framework, workload semantics,
target policy, or service-level objectives.

## Keep the owners separate

1. Treat case-harness or another performance framework as infrastructure for load scheduling,
   lifecycle, observation, metric reduction, artifacts, reports, and Verdicts.
2. Treat the project as owner of its Workloads, Cases, Experiment/Profile configuration, target
   adapters, Probes, SLOs, safety limits, canonical command, and comparison baselines.
3. Treat this skill as the operator that discovers those assets, selects and runs the relevant
   experiment, checks evidence validity, interprets or compares results, and helps evolve bounded
   project-owned coverage when requested.

Do not call a lower-level framework directly when the project exposes a wrapper. Framework code
without a project-owned workload and runnable profile is `no_capability`.

## Discover the capability

Read the project's AGENTS.md and README first, then locate:

- canonical commands and directories for performance, load, capacity, stress, soak, scalability,
  or regression testing;
- the subject boundary and target environment, including whether it is a local process or remote
  system such as Kubernetes, the deployed revision, where the load runner executes, and how it
  reaches the application endpoint;
- workload adapters, stable Cases or stimuli, case mix, and protocol-specific success judgment;
- named profiles or experiments, resource profiles, open- or closed-loop load, stages, duration,
  concurrency or arrival rate, and request/time limits;
- SLOs, breakers, abort conditions, cleanup, target authorization, and operating notes;
- request and resource observations, run models, Verdicts, reports, and historical baselines.

Choose the smallest existing profile that answers the user's question. Do not silently replace a
capacity scan or soak test with a smoke profile and present the narrower result as equivalent.

Classify discovery as `ready`, `blocked`, or `no_capability`. `ready` requires a verified data-plane
connection from the load runner to the intended target, not only a configured URL or Kubernetes
control-plane access. A profile with an unavailable target, credential, dependency, quota, load
runner, or required observer is `blocked`, not an executable pass. Report ambiguity instead of
guessing when repository evidence cannot select a profile or target.

## Prepare a live run safely

Before generating live load or changing a performance Target, read both the shared
[Environment contract](../../references/environment.md) and
[performance load-environment preparation](references/load-environment.md) completely. Inspection and
offline re-analysis of an existing run do not require Environment preparation.

Prepare three explicit layers in order:

1. **Target environment:** identify the local or remote Target, subject revision, scope, and
   declared resource profile before choosing how to reach it.
2. **Runner and connection:** select the Runner, use the first applicable authorized Connection in
   the Environment contract's priority order, then probe the exact endpoint from that Runner. Keep
   the path stable across compared runs; switching between Service DNS and ClusterIP is an
   Environment change and must be reported.
3. **Load environment:** establish load-generator capacity,
   dependency quotas, fresh request/resource observations, initial steady state, safety limits,
   cooldown, and cleanup path.

For a local Runner reaching Kubernetes, the first Connection is normally a run-owned port-forward.
For capacity, stress, or soak work that could saturate it, skip that option and use an authorized
direct path or in-environment Runner so the connection helper does not become an unmeasured
bottleneck.

Preserve the requested revision, target, profile, workload, resource envelope, load model, case mix,
and SLO policy. Do not deploy, install dependencies, create credentials, resize resources, or switch
targets unless the user authorized that action. Shared and production environments require
authorization appropriate to the declared load and blast radius.

## Run and preserve evidence

Use the project-owned entrypoint and its native lifecycle. Record the exact command and realized
configuration, not only the profile filename. Respect warmup, ramp, measurement, cooldown, breaker,
graceful-stop, cleanup, and retry semantics; do not edit a profile midway or retry a failed run only
to obtain green output.

Keep these facts distinct:

- load is an experimental input, not an observed metric;
- request Outcomes and resource samples are observations;
- per-request judgment and run-level SLOs are evaluation policy;
- framework or environment errors are not SLO failures.

Treat target-connection and load-generator failures as environment `error` or `blocked`, not product
latency or error-rate regressions. An alternate runner, endpoint, tunnel, or in-cluster execution is
a changed Environment and must be reported as such.

Capture the native run model, raw request/resource facts, Verdict, report, logs, traces, and cleanup
evidence exposed by the project. When the runner supports offline report or SLO recomputation, use
the persisted run rather than generating load again.

## Validate and interpret

Check data health before drawing a performance conclusion:

1. Verify the subject revision, target, resource profile, load model, case mix, and comparison
   cohort are the intended ones.
2. Check completed measurement windows, stop reasons, sample counts, error and drop counts,
   cancellations, probe errors, missing series, and skipped SLOs.
3. Treat latency as a fact only for completed requests. Account for open-loop drops and closed-loop
   coordinated-omission caveats rather than comparing percentiles in isolation.
4. Read request and resource facts over the same realized window. Ramp, hold, measurement, and
   cooldown answer different questions and must not be flattened into one aggregate.
5. Read throughput, latency distribution, errors, drops, saturation, resource use, restarts, and
   scaling behavior together. Capacity claims require complete stable-load windows.
6. Compare runs only after checking workload, load, resources, environment, and SLO comparability.
   Describe unmatched factors instead of attributing every difference to the code revision.

A passed SLO means the declared gate passed under the realized experiment; it does not prove an
untested capacity. A regression is an observed relationship, not a root-cause diagnosis. Profiling,
tracing, or source investigation is separate evidence.

Preserve native outcomes: `passed`, `failed`, `skipped`, `error`, `blocked`, and `no_capability` are
distinct. Missing strict observations or incomplete windows cannot be converted into a pass.

## Grow coverage deliberately

When the user explicitly asks to add or strengthen performance coverage:

1. Map the existing workload, profiles, metrics, and baselines; choose one bounded missing question.
2. Reuse project adapters and lifecycle. Keep stable input and judgment in project Case assets;
   keep load weights, stages, resources, and SLO selection in the Experiment/Profile.
3. Add protocol facts in the Workload and observations in Probes before adding derived claims to a
   report. Make a metric affect pass/fail only through an explicit project-owned SLO.
4. Validate configuration and workload behavior offline, then run the smallest relevant live
   experiment when its target and impact are authorized.
5. Do not weaken thresholds, shorten measurement until it loses meaning, or drop missing data merely
   to make the new profile pass.

Improve a shared harness only when the capability is genuinely reusable across projects. Project
protocols, target locations, credentials, load limits, and learned thresholds stay in the project.

## Report and retain learning

Lead with the decision-relevant result, then report the project and revision, target and subject,
runner location and connection path, profile and exact command, resource/load/case-mix realization,
safety controls, native Verdict, data-health caveats, SLO results, key request and resource
observations, baseline comparison, artifact paths, cleanup, and unverified areas.

Persist run-specific evidence and reusable project operating knowledge beside the project's perf
assets. Do not copy credentials, private endpoints, volatile measurements, or project-only commands
into this skill.

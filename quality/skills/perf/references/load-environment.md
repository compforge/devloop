# Performance load-environment preparation

Read the [shared Environment contract](../../../references/environment.md) first. This
reference adds the performance-specific resource, load-generator, observation, guardrail, and
cooldown requirements.

## Establish the load contract

Resolve before a live run:

- the selected resource profile and whether the Harness applies it or only records it;
- open- or closed-loop load, stages, maximum arrival rate or concurrency, inflight/request limits,
  duration, case mix, and expected durable-data growth;
- load-generator location and capacity;
- required model, database, sandbox, queue, storage, or other downstream quotas;
- request and resource observations, clocks, SLOs, breaker and abort conditions;
- deactivation, cooldown, cleanup, and restoration checks.

Do not infer missing values from an example profile. Project profiles and Target policy are the
authority. Never run material load against production or a shared Target merely because a profile
and credential are available.

## Prepare the performance environment

Verify that:

- the subject's resources, replicas, worker floor, autoscaling, and other capacity policy match the
  selected profile;
- the load generator has enough CPU, memory, file descriptors, sockets, and network capacity for
  the declared arrival rate or concurrency;
- the load path does not contain an unintended proxy, tunnel bottleneck, or local contention;
- dependencies have known authorized capacity for the experiment;
- request and resource Probes produce fresh samples for the intended components over aligned time;
- current errors, restarts, backlog, saturation, scaling state, and retained data are understood.

When a local Runner shares a machine with the Target, record the contention and resource isolation.
When a remote Kubernetes Target is used, separately verify deployed images/resources, application
connectivity, and Kubernetes observation. If these conditions are uncontrolled, the run may
characterize the Runner, connection, or downstream quota rather than the subject.

## Bound and execute load

Prefer a project-declared smoke or lowest load arm before higher-impact arms when that is part of
the canonical experiment. Keep explicit maximum inflight/request/time limits and a project-defined
breaker. Abort when its condition fires; the abort is evidence, not a reason to disable the guard
and retry.

Run the declared lifecycle without changing the Target or profile during measurement:

```text
prepare fixtures → verify steady state → warm up → ramp/hold measurement
  → deactivate load → cooldown observation → cleanup → verify restoration
```

Load activation, measurement, SLO judgment, and cleanup remain separate outcomes. Do not shorten a
measurement window, discard missing Probes, or remove a failed arm while retaining the original
experiment identity.

## Retain performance evidence

In addition to the shared Environment evidence, retain the realized resource and load
configuration, case mix, measurement windows, stop/breaker outcome, dependency limitations,
request and resource facts, SLO results, cooldown, and cleanup.

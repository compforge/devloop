# Performance load-environment preparation

Read [environment preparation](../../../references/environment.md) first. This reference adds
performance-specific resource, generator, observation, guardrail, and cooldown preparation.
Interpret scheduling and result semantics through [load and evidence](load-and-evidence.md).

## Establish the load contract

Resolve before a live run:

- the selected resource profile and whether the harness applies it or only records it;
- request rate and maximum inflight count, admission behavior at that limit, arrival distribution,
  phase schedule, measurement duration, request/time budgets, case mix, and durable-data growth;
- load-generator location, revision, and capacity;
- required model, database, sandbox, queue, storage, or other downstream quotas;
- request and resource observations, clocks, SLOs, breakers, and abort conditions;
- stop, drain, cancellation, deactivation, cooldown observation, cleanup, and restoration behavior.

Project profiles and target policy are authoritative. Do not fill missing limits from an example
profile. A profile and credentials alone do not authorize material load against a shared or
production target.

## Prepare the performance environment

Verify that:

- target resources, replicas, worker floor, autoscaling, and other capacity policy match the profile;
- the generator has enough CPU, memory, file descriptors, sockets, and network capacity for both
  the declared initiation rate and full-lifecycle inflight count;
- the application path does not contain an unintended proxy, tunnel bottleneck, or local contention;
- dependencies have known authorized capacity for the experiment;
- request and resource observations produce fresh samples for the intended Service and actual
  Workload instances over aligned time;
- current errors, restarts, backlog, saturation, scaling state, and retained data are understood.

When the test process shares a machine with the target, record contention and resource isolation.
For Kubernetes, independently verify deployed images/resources, application connectivity, and
resource observation. Uncontrolled conditions may measure the generator, connection, or downstream
quota rather than the subject's capacity.

## Bound and execute load

Use a project-declared smoke or lowest Arm before higher-impact Arms when it is part of the canonical
experiment. Keep explicit inflight/request/time limits and a project-owned breaker. Its activation
is evidence to retain, not a reason to disable the guard and retry.

Run the declared lifecycle with observable readiness, phase boundaries, stop behavior, and recovery:

```text
prepare fixtures and verify steady state
  → warmup and hold/stage measurement
  → stop initiation, drain or cancel and join inflight calls
  → deactivate, finish cooldown observation, clean up, verify restoration
```

Confirm that requests have exited before releasing their clients or connections. Keep request
completion and optional resource-recovery observation distinct. Preserve the declared profile
throughout measurement; shortened windows, missing Probes, or removed Arms change what ran.

## Retain performance evidence

In addition to shared run evidence, retain the realized resource/load configuration, case mix,
actual phase Windows, inflight limits and time spent limited, stop/breaker and interruption census,
dependency limitations, request/resource observations, independent judgments, SLO coverage,
cooldown, and cleanup.

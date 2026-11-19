# Run a load test

Use this guide for live load. Follow the shared [environment preparation](../../../references/environment.md)
to identify the target revision, execution location, connection path, and run-owned fixtures.
Select a project-owned profile using [load.md](load.md). Check whether the harness applies the
resource profile or records resources provisioned elsewhere.

## Verify readiness

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

Check the request, time, inflight, and data-growth budgets, breaker thresholds, and abort conditions
against the target policy. Confirm authorization for the target and impact, including any deployment,
dependency installation, credential creation, resizing, or target switch. Record deviations and the
original failure if an alternate connection is used.

## Show and confirm the actual configuration before load

Before starting live load, print the actual raw configuration that will be executed in a fenced
YAML/JSON block, with its file path and exact command. Use the final file after overrides and show
any effective defaults that affect load separately; do not substitute a remembered profile or a
prose summary. Redact credentials and sensitive payload values without hiding the experimental
conditions: target and connection, Cases and routing selectors (including whether bot_id is absent),
request_rate, max_inflight, warmup/hold/cooldown, request/cleanup timeouts, breakers, and observations.
Explicitly describe inf/unlimited as no rate limit; an inflight cap does not limit request rate.

Wait for the user's explicit confirmation of these displayed configurations before sending load.
A general request to run is not confirmation of a configuration selected later. For a comparison,
show every configuration and identify the intended differences; keep other load parameters equal.
One confirmation covers the displayed sequence of runs, without asking again between unchanged
runs. If the configuration, target or connection changes, show the revised configuration and obtain
confirmation again. Do not quietly replace a load run with a single-request preflight.

## Execute and verify recovery

Use the project's canonical entrypoint and the confirmed profile. If the experiment declares a
smoke or lowest Arm before higher-impact Arms, run it first. Record readiness and phase boundaries
as they occur. Preserve the first failure and any breaker activation, together with the profile
and observations in effect at the time.

When initiation stops, drain or cancel and join outstanding calls before releasing clients.
Deactivate the load, finish any declared cooldown observation, clean up fixtures, and verify
restoration against the pre-run state.

Retain the exact command, effective configuration and Case mix, actual phase times, stop reason,
inflight and interruption records, dependency limitations, request and resource observations,
evaluations, Verdict, logs, traces, and cleanup outcome. Record gaps such as missing observations
or SLO coverage alongside the artifacts.

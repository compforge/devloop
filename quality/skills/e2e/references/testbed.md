# Preparing and controlling the testbed

The **testbed** is the complete observable state required to make an E2E scenario real: the system
under test, its relevant dependencies, identities, data, configuration, external resources, and any
temporary condition applied for the case. Preparing it is more than running setup commands. The
runner must verify that the intended state actually exists, keep its effects bounded, and restore
what it changed.

The project owns the concrete fixtures, scripts, environment knowledge, fault controls, and cleanup
mechanisms. This skill discovers and operates those assets; it does not replace them with generic
commands or copy project-only facts into the plugin.

## Establish the testbed contract

Before changing the target, identify:

- the system-under-test identity and the target in which the case will run;
- state that must already exist and the observable source of truth for it;
- fixtures the test will create, reuse, mutate, and remove;
- temporary conditions the scenario must apply and later reverse;
- the expected blast radius, permissions, and impact on other users or runs;
- readiness evidence required before the action under test may begin;
- restoration and cleanup evidence required after the case finishes.

Do not infer readiness from a setup command's exit code alone. Check the state at the layer that the
scenario depends on: a resource exists and is usable, an identity has the intended access, a
dependency exposes the requested behavior, or an injected condition is observable from the tested
boundary.

## Distinguish preparation kinds

Keep three kinds of testbed work visible because they have different ownership and failure
semantics:

1. **Pre-existing target conditions** are supplied by the selected environment or device, such as a
   deployed revision, enabled capability, reachable dependency, or available account. If a required
   condition is absent and the run is not authorized to create it, the case is `blocked` or
   `skipped`, not passed.
2. **Test-owned fixtures** are created for the run, such as identities, records, files, sessions, or
   temporary resources. Give them stable run identity, isolate them from concurrent tests, and
   remove them through project-owned cleanup.
3. **Transient scenario controls** deliberately alter behavior for a bounded period, such as time,
   dependency responses, capacity, connectivity, process availability, or faults. Apply them only
   after the normal testbed is ready, verify that they took effect, and always restore them.

Do not hide these distinctions behind one generic setup result. A missing environment capability,
a fixture creation error, and a failed injection require different evidence and remediation.

## Follow the testbed lifecycle

1. Read the project-owned runbook, fixture, or setup entrypoint nearest to the selected E2E cases.
2. Describe the minimum state required by the scenario and how each condition will be observed.
3. Check scope and authorization before creating identities, deploying revisions, mutating shared
   state, injecting faults, or consuming material capacity.
4. Prepare preconditions and test-owned fixtures through the project's canonical mechanisms.
5. Verify readiness from observable state and, for a chaos experiment, record the normal steady
   state; stop as `blocked` or `error` when setup cannot be proven.
6. Apply any transient scenario control and verify the intended condition before triggering the
   behavior under test.
7. Run the case without silently repairing or changing the prepared state midway through its
   assertions.
8. Remove transient controls, clean up test-owned fixtures, and verify restoration with a fresh
   observation even when the case failed earlier.

Cleanup is part of testbed evidence, not proof that the business assertions passed. A case may pass
its contract and still finish with a cleanup error; report both states instead of flattening one
into the other.

## Run fault-injection and chaos experiments

**Fault injection** is a mechanism that deliberately creates a failure condition so a case can
verify degradation, containment, retry, recovery, or consistency behavior. A **chaos experiment**
is the broader controlled learning loop: establish a steady state and hypothesis, introduce one or
more turbulent conditions, observe the system, enforce abort criteria, restore the testbed, and
verify recovery. Fault injection can realize a chaos condition, but one injected failure is not
automatically chaos engineering.

Both are testbed phases, not separate E2E verdicts or a general license to destabilize the target.

Before fault injection or a chaos experiment, require:

- a hypothesis and observable steady-state indicators when the work is a chaos experiment;
- a named failure mode and the business or system boundary it is meant to exercise;
- a bounded target and blast radius that exclude unrelated users and runs where practical;
- explicit abort conditions and an operator or mechanism able to stop the experiment;
- a reversible, project-owned injection mechanism with a known cleanup path;
- an observation that proves the fault became active;
- expected behavior while the fault is active and, when relevant, after recovery;
- authorization appropriate to the target and expected impact.

If the injected condition cannot be confirmed, the scenario did not execute under its declared
condition. Treat that as `blocked` or `error`, not as a product pass. If the verified condition is
active and the observed business behavior violates the case contract, the case is `failed`. If an
abort condition fires or restoration cannot be confirmed, stop the experiment, report the cleanup
error, and preserve the evidence needed for recovery.

Never improvise destructive fault injection or a chaos experiment in a shared or production
environment. Use only the project's declared mechanism and obtain explicit authorization when the
action can disrupt service, destroy data, change capacity, or affect other users.

## Preserve evidence and project knowledge

Retain enough evidence to reconstruct the realized testbed without copying secrets or volatile
environment details into this skill:

- system-under-test and target identity;
- pre-existing conditions that were checked;
- fixtures created or reused and their stable run identity;
- transient controls, fault injections, or chaos experiments applied, including the hypothesis,
  steady-state observations, activation evidence, abort outcome, and duration when applicable;
- readiness, business assertion, restoration, and cleanup outcomes;
- artifact, log, trace, screenshot, or report paths owned by the project.

Stable setup rules, fixture contracts, injection mechanisms, and cleanup procedures belong beside
the project's E2E assets. Promote only cross-project testbed principles into this reference.

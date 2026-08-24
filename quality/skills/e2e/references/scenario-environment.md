# E2E scenario preparation

Read the [shared Environment contract](../../../references/environment.md) first. This
reference adds the E2E-specific preparation for fixtures, scenario controls, fault injection, and
chaos experiments.

## Prepare the scenario

Identify the cases selected and the user or API boundary they exercise. For each fixture and
control, establish:

- what the run creates, reuses, mutates, and removes;
- the stable run identity that isolates it from concurrent tests;
- the readiness observation required before the case begins;
- the expected side effects and impact on other users or runs;
- the restoration evidence required after the case finishes.

Apply scenario controls only after normal Target readiness is established. If a required fixture or
control cannot be created or observed, the scenario is `blocked` or `error`; it did not execute
under its declared conditions.

## Run fault injection and chaos experiments

Fault injection is a mechanism that creates one failure condition. A chaos experiment is the wider
learning loop: establish steady state and a hypothesis, activate turbulence, observe containment or
recovery, enforce abort criteria, restore the Environment, and verify recovery. One deleted
process is not automatically a complete chaos experiment.

Before either, require:

- a named failure mode and the business or system boundary it exercises;
- a bounded Target and blast radius;
- explicit activation evidence, expected behavior, and abort conditions;
- an operator or project-owned mechanism able to stop and reverse it;
- authorization appropriate to the expected impact;
- a known cleanup path and post-recovery observation.

If the fault cannot be confirmed, the case is `blocked` or `error`, not passed. If the confirmed
fault violates the case contract, the case is `failed`. If an abort condition fires or restoration
cannot be proven, stop and preserve recovery evidence.

Never improvise destructive injection in a shared or production Target. Use the project's declared
mechanism and keep fault activation, business assertion, and cleanup as separate outcomes.

## Retain E2E evidence

In addition to the shared Environment evidence, retain selected cases, fixture identities,
control or fault activation, steady-state and recovery observations, executed/skipped coverage,
assertion results, and cleanup outcomes.

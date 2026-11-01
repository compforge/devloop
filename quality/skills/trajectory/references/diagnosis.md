# Diagnosing trajectory problems

Use this method to diagnose failures, investigate redundant overhead, and connect conclusions
to execution evidence. Cover the material issues within the requested analysis scope.

When the user asks what to optimize next, additionally use "Choose one next problem" to select
one bounded issue with a measurable signal and enough evidence to justify an experiment.
That selection does not replace the diagnostic summary.

## Treat trajectory smells as diagnostic findings

A **trajectory smell** is a recurring, observable action pattern that suggests avoidable cost,
fragility, or effect loss. Like a code smell, it identifies where to investigate; it is not itself a
proven defect, root cause, or required fix.

Separate the detection of a pattern from the judgment of its value:

- Generic analysis can identify high consumption, repeated observations,
  ineffective tool calls, and stalled progress.
- Project-specific analysis determines whether the work was necessary, whether
  the evidence supports the conclusion, and whether the intended outcome was
  achieved.

For a slow or expensive execution, build an evidence table before recommending changes. Use
source-recorded Turns where available, otherwise scoped call or Operation references. Apply the
shared [cost attribution rules](evaluation.md#cost-attribution) when work spans Jobs or Sessions:

| Turn / Node reference | New information | Retained context | Input/output tokens | Model/tool time | Action and actual result | Decision advanced |
|---|---|---|---|---|---|---|

Use the request actually sent to the model. Distinguish duplicate content within
a request, useful evidence retained across turns, and obsolete exploration.
A successful tool status does not prove that the requested evidence was
obtained; inspect the returned content.

Label each proposed optimization as confirmed redundancy, suspected low-value
work, or an unresolved attribution question. State the expected saving, the
evidence that must survive, and the effect guardrail for the experiment.

Explicit failures and errors are the strongest smells: failed or malformed model output, invalid
tool arguments, rejected tool calls, tool/runtime errors, timeouts, cancellations, and incomplete
delivery. Less direct smells include unnecessary model calls, unnecessary tool calls, repeated
tool-call sequences, repair or retry loops, oversized observations with low use, state
reconstruction, and work that completes too late to be delivered.

A project may implement a reusable smell Detector that emits Findings and quantify its impact with
Measurements, but `Trajectory Smell` is diagnostic language for this skill rather than a new
framework entity. Even an obvious error is an observed failure, not automatic proof of which
component caused it.

## Establish the diagnostic scope

Apply [evidence requirements](evidence.md#fix-the-evidence-boundary) and
[evaluation rules](evaluation.md#interpret-results) before ranking problems. If missing provenance,
coverage or comparable inputs materially changes the conclusion, treat evidence quality or experiment
design as the immediate problem rather than optimizing against an unreliable signal.

Effect regression is a leading diagnostic signal when comparable workloads deteriorate under the
same criterion. Investigate the decisions and actions behind the change; use the
[experiment controls](evaluation.md#controlled-experiments) to distinguish a generating-version
regression from a change in workload or annotation coverage.

## Trace effect loss to its cause

Good diagnosis explains both whether the result met the goal and where and why work departed from
it. Use the three views to reconstruct a supported chain:

1. **Expected versus actual:** establish the unmet criterion and affected outcome in Job View.
   Use project requirements or independent checks; the agent's own verdict is an output to inspect.
2. **Point of deviation:** follow explicit dependencies through Session decisions, tool results,
   handoffs and delivery. Find the earliest supported departure on the path to that outcome and,
   where available, the preceding correct state. The first error by timestamp may be unrelated or
   recovered; show how the candidate deviation propagated, was amplified or escaped correction.
3. **Mechanism and owner:** inspect the relevant Context View and actual tool observations. Separate
   a wrong objective, unavailable evidence, evidence lost during context construction, a decision
   inconsistent with visible evidence, execution failure and delivery failure. Trace the supported
   mechanism to its owning instructions, context policy, tool contract, loop or orchestration.
   A symptom such as "wrong answer" or "the model did not understand" does not explain that mechanism.
4. **Causal confidence:** state the evidence connecting the mechanism to the deviation and outcome,
   contrary evidence, and any missing link. Identify an observation or bounded experiment that
   would distinguish competing explanations; run it only within the requested scope. When the
   origin is not observed, report the earliest visible deviation and root-cause hypotheses rather
   than inventing a unique cause or an unobserved model reasoning process.

For example, when a conclusion overlooks a recovery path, check whether that path was unavailable,
removed from the request, or present in the actual input but not accounted for in the response.
Those observations lead to different candidate fixes. They do not by themselves prove that adding
context or changing instructions will improve the result; verify that through a controlled comparison.

## Search in priority order

1. **Version effect regression:** a newer generation configuration produces worse effect on the same
   Case/input workload or a controlled cohort under the same evaluation semantics.
2. **Execution health:** failed, canceled, timed-out, or incomplete trajectories. An agent that does
   not finish cannot reliably realize its quality potential.
3. **Action errors:** malformed model output, invalid tool arguments, rejected calls, tool errors,
   and repair loops, including errors that a later retry hides from the final outcome.
4. **Effect regression within a version:** wrong, unsupported, missed, repeat, low-score, or
   low-completion outcomes, using the project's own Verifiers and annotations.
5. **Pareto regression:** on comparable work and coverage, no measured Good/Fast/Cheap dimension
   improves and at least one worsens. If dimensions move in different directions, inspect the
   trade-off against project priorities rather than labeling it a Pareto regression.
6. **Cost hotspot:** effect is acceptable, but a high-volume target or cohort dominates avoidable
   normalized cost.
7. **Long tail:** average is stable while p95/p99, retries, timeouts, or a small cohort deteriorates.

Totals identify operational spend; normalized metrics identify behavior. Inspect both before
claiming a regression.

## Narrow the scope

Slice the candidate signal only along dimensions already supported by the Worksheet, for example:

- evaluation target or stage;
- quality versus cost category;
- outcome, failure kind, or finding code;
- model, tool version, feature set, repository, language, or workload cohort.

Stop slicing when the cohort becomes too small to support the claim. Then inspect representative
Worksheet rows and their trajectory evidence: at least one common example and, when relevant, one
counterexample. Separate observations from causal hypotheses.

## Find smells in repeated behavior, not only aggregate outcomes

Aggregate metrics reveal where impact concentrates; step sequences reveal what the agent repeatedly
does. Search representative and counterexample trajectories for motifs such as:

- model calls made without a material new observation, state change, or decision requirement;
- model calls that only transform data a deterministic mechanism already has enough information to
  transform;
- model-produced tool arguments rejected by schema validation or the tool runtime;
- failures that trigger a successful retry and therefore disappear from the final outcome;
- several calls expressing one already-known intent;
- one tool call predictably followed by another whose arguments come from the first result;
- repeated argument correction or switching between overlapping tools;
- large observations that are barely used by the next decision;
- information fetched again after compaction or a phase boundary;
- retries continuing after evidence has converged;
- independent actions being serialized;
- useful work finishing, but delivery starting too late to complete.

Describe the smell without project-specific tool names and before naming a fix. Quantify occurrence
count, affected trajectory share, model or tool calls per occurrence, token and time contribution,
outcome correlation, and counterexamples when the data allows it. A frequent transition is an
optimization signal, not proof that combining two operations preserves semantics.

## Choose one next problem

Prioritize using four judgments rather than a rigid score:

- **Impact:** effect loss, wasted cost, or inability to complete;
- **Prevalence:** affected trajectories and share of the relevant cohort;
- **Confidence:** data coverage, annotation quality, and direct trajectory evidence;
- **Controllability:** whether one bounded lever can test the suspected cause.

Prefer a smaller high-confidence problem over a broad label with no actionable mechanism. When
human labels are sparse, describe the result as directional and consider annotation coverage the
next experiment prerequisite.

Record the selected problem in this shape:

```text
Smell or problem: one observable behavior, not its assumed cause
Scope: Dataset/run, generation provenance, target, cohort, and denominator
Signal: current value, baseline value, and direction
Evidence: representative trajectory/Worksheet identities
Likely causes: ordered hypotheses, each with a disconfirming check
Change surface: instructions, tools, context, loop mechanism, model, or orchestration
Next experiment: one principal lever
Primary metric: the signal expected to improve
Guardrails: acceptable bounds for the other Good/Fast/Cheap dimensions, completion and data health
```

This note is project evidence, not a new framework entity. Store it beside the project's trajectory
evaluation or experiment assets.

# Finding the next trajectory problem

Use this method when the user asks what to optimize next. The output is one bounded problem with a
measurable signal and enough evidence to justify an experiment, not a backlog of every unusual row.

## Treat trajectory smells as diagnostic findings

A **trajectory smell** is a recurring, observable action pattern that suggests avoidable cost,
fragility, or effect loss. Like a code smell, it identifies where to investigate; it is not itself a
proven defect, root cause, or required fix.

Explicit failures and errors are the strongest smells: failed or malformed model output, invalid
tool arguments, rejected tool calls, tool/runtime errors, timeouts, cancellations, and incomplete
delivery. Less direct smells include unnecessary model calls, unnecessary tool calls, repeated
tool-call sequences, repair or retry loops, oversized observations with low use, state
reconstruction, and work that completes too late to be delivered.

A project may implement a reusable smell Detector that emits Findings and quantify its impact with
Measurements, but `Trajectory Smell` is diagnostic language for this skill rather than a new
framework entity. Even an obvious error is an observed failure, not automatic proof of which
component caused it.

## Establish trustworthy comparison

Before ranking agent problems, verify:

- source and Dataset versions are known and the intended time or case window is complete;
- every comparison cohort has generation provenance sufficient to distinguish behavior-producing
  versions: agent/application revision, instruction and skill versions, tool set and contract,
  loop/compact configuration, model, and orchestration as applicable;
- build failures, unmatched annotations, and unknown execution outcomes are visible;
- label coverage and the exact denominator accompany every quality rate;
- model-usage and duration coverage are sufficient for cost claims;
- evaluator comparisons reuse the same TrajectoryDataset, while generator comparisons use aligned
  Case/input cohorts and explicitly control their differences;
- target, model, tool version, feature flags, and other material dimensions are available.

If one of these conditions materially changes the conclusion, the next problem is data quality or
experiment design. Do not optimize an agent against an untrustworthy comparison.

Do not substitute a Dataset version or an instrumentation-library version for generation
provenance. A generic Trajectory may carry generation provenance in metadata and step attributes,
but the project Loader or Dataset builder must populate it from the actual producer. If that
provenance is missing, report a provenance gap: effect can still be described for the cohort, but
it cannot be attributed to a generating version.

## Treat version effect regression as a leading smell

An effect decline between generator versions is a stronger signal than a local efficiency pattern.
Hold the same Case/input workload and evaluation semantics fixed, let each version generate its own
Trajectories, and align the resulting cohorts by stable Case or input identity. Because the
observations changed, they are not literally the same TrajectoryDataset. When a controlled replay
is unavailable, require comparable cohorts and disclose differences in cases, labels, targets,
environment, and coverage.

A week-over-week decline is an operational alert, not automatically a version regression: workload
mix and annotation coverage may have changed. Group by generation provenance within or across the time
windows. Escalate the smell when the same effect metric declines under the same Evaluator and policy,
especially when completion or cost also regresses.

## Search in priority order

1. **Version effect regression:** a newer generation configuration produces worse effect on the same
   Case/input workload or a controlled cohort under the same evaluation semantics.
2. **Execution health:** failed, canceled, timed-out, or incomplete trajectories. An agent that does
   not finish cannot reliably realize its quality potential.
3. **Action errors:** malformed model output, invalid tool arguments, rejected calls, tool errors,
   and repair loops, including errors that a later retry hides from the final outcome.
4. **Effect regression within a version:** wrong, unsupported, missed, repeat, low-score, or
   low-completion outcomes, using the project's own Evaluators and annotations.
5. **Pareto regression:** effect is unchanged or worse while normalized token, time, model calls, or
   tool calls increase.
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
Change surface: system prompt, tool contract, loop mechanism, compact, model, or orchestration
Next experiment: one principal lever
Primary metric: the signal expected to improve
Guardrails: effect, completion, and data-health metrics that must not regress
```

This note is project evidence, not a new framework entity. Store it beside the project's trajectory
evaluation or experiment assets.

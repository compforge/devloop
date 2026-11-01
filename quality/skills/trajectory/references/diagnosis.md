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

Good diagnosis explains whether the result met the goal and how a deviation reached that result.
Use a graph perspective: actions consume and produce evidence, intermediate judgments and delivered
artifacts. Follow those dependencies across Job, Session and Context views, expanding the branches
needed to explain the outcome. Existing records and explicit references can support this reasoning;
a persisted graph or a new view is not a prerequisite.

1. **Anchor the deviation:** establish the expected behavior and affected outcome using project
   requirements or independent checks. The agent's own verdict is an output to inspect.
2. **Trace backward from the outcome:** identify the decisions and inputs that produced it, then
   follow their recorded sources. Inspect the actual request in Context View and the relevant
   calls in Session View. Keep the identity and version of a claim or artifact through handoffs;
   distinguish evidence available to read, actually present in a request, and cited in a decision.
   Temporal proximity alone does not establish a dependency; mark missing links explicitly.
3. **Inspect what changed at each step:** compare consumed evidence with the resulting judgment
   or artifact. Look for facts lost during selection or compression, omitted conditions,
   uncertainty promoted to certainty, stale versions, and corrections absent from the delivered
   content. Locate the earliest supported deviation on a path to the affected outcome and, where
   available, the preceding correct state.
4. **Follow propagation and correction:** trace forward to establish how the deviation affected
   delivery. Inspect relevant review, retry, recovery and handoff steps: did they correct it,
   amplify it, or allow it to pass? Identify both where the error arose and where an opportunity
   to correct it failed. An earlier error may be unrelated or already corrected; later recovery
   can limit duration while leaving an earlier loss or irreversible side effect intact.
5. **Explain the mechanism and owner:** distinguish unavailable evidence, context loss, a decision
   inconsistent with visible evidence, execution failure and delivery failure. Relate the
   supported mechanism to instructions, context policy, tool contracts, loop or orchestration.
   Preserve contrary evidence and separate recorded dependencies from inferred causal explanations.
   State missing links and an observation or bounded experiment that would distinguish competing
   causes; execute it only within the requested scope. If the origin is unobserved, report the
   earliest visible deviation and root-cause hypotheses without inventing a unique cause or hidden
   model reasoning.

For example, a review may propose "the failure is permanent", while a later assessment recognizes
that the next successful pass restores the state, approves the original claim, and delivery retains
"permanent". Inspect both the initial overstatement and the failed correction: a corrected assessment
reason does not prove that the approved or delivered claim was corrected. If the recovery evidence
was absent from the request, investigate acquisition or context construction instead. These paths
suggest different fixes; neither the dependency chain nor the diagnosis alone proves a fix will
improve Good, Fast, Cheap. Verify the chosen change through a controlled comparison.

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

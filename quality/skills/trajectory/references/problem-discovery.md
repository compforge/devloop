# Finding the next trajectory problem

Use this method when the user asks what to optimize next. The output is one bounded problem with a
measurable signal and enough evidence to justify an experiment, not a backlog of every unusual row.

## Establish trustworthy comparison

Before ranking agent problems, verify:

- source and Dataset versions are known and the intended time or case window is complete;
- build failures, unmatched annotations, and unknown execution outcomes are visible;
- label coverage and the exact denominator accompany every quality rate;
- model-usage and duration coverage are sufficient for cost claims;
- current and baseline runs use the same Dataset, or cohort differences are explicitly controlled;
- target, model, tool version, feature flags, and other material dimensions are available.

If one of these conditions materially changes the conclusion, the next problem is data quality or
experiment design. Do not optimize an agent against an untrustworthy comparison.

## Search in priority order

1. **Execution health:** failed, canceled, timed-out, or incomplete trajectories. An agent that does
   not finish cannot reliably realize its quality potential.
2. **Effect regression:** wrong, unsupported, missed, repeat, low-score, or low-completion outcomes,
   using the project's own Evaluators and annotations.
3. **Pareto regression:** effect is unchanged or worse while normalized token, time, model calls, or
   tool calls increase.
4. **Cost hotspot:** effect is acceptable, but a high-volume target or cohort dominates avoidable
   normalized cost.
5. **Long tail:** average is stable while p95/p99, retries, timeouts, or a small cohort deteriorates.

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

## Mine repeated behavior, not only aggregate outcomes

Aggregate metrics reveal where impact concentrates; step sequences reveal what the agent repeatedly
does. Search representative and counterexample trajectories for motifs such as:

- several calls expressing one already-known intent;
- one tool call predictably followed by another whose arguments come from the first result;
- repeated argument correction or switching between overlapping tools;
- large observations that are barely used by the next decision;
- information fetched again after compaction or a phase boundary;
- retries continuing after evidence has converged;
- independent actions being serialized;
- useful work finishing, but delivery starting too late to complete.

Describe the motif without project-specific tool names and before naming a fix. Quantify occurrence
count, affected trajectory share, calls or tokens per occurrence, time contribution, outcome
correlation, and counterexamples when the data allows it. A frequent transition is an optimization
signal, not proof that combining two operations preserves semantics.

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
Problem: one observable behavior, not its assumed cause
Scope: Dataset/run, target, cohort, and denominator
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

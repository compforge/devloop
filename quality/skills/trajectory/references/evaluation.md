# Evaluating Session and Job behavior

Use this reference for diagnosis, effect/cost comparison and controlled optimization. Start from
fixed observations and the project's goals. The shared roles and result states are defined in
[Quality concepts](../../../CONCEPTS.md); subject and evidence identity are defined in
[Observation](observation.md) and [Evidence](evidence.md).

## Effect and efficiency

Effect asks whether the work met its goal with correct, sufficient evidence and useful results.
Efficiency asks whether time, calls and tokens were justified by their contribution. Both apply to
Session and Job observations. High consumption identifies an investigation target, not waste.

For a Session, examine context use, decisions, errors, repeated work and progress for the inputs it
serves. For a Job, examine the goal, admitted work, division of labor, handoffs, aggregation and
result delivery. An open continuous Session is not a failed Job; a completed Job is not proof its
result is correct. Deliberate silence, recorded understanding or delegation can be valid outcomes
under the project's criterion. An absent output alone cannot establish that criterion was met.

Follow result problems into relevant Session calls and context. Follow suspicious Session behavior
back to Job goals and consequences where explicit links exist. Missing links constrain attribution;
useful analysis of the available perspective can still proceed.

## Evaluation roles and evidence

| Role | Output | Meaning |
|---|---|---|
| Measurer | Measurement | Deterministic facts such as observed calls, usage or duration. |
| Detector | Finding | An evidenced pattern worth investigating; possible causes remain hypotheses. |
| Verifier | Evaluation | Judgment against an explicit criterion, with verdict or score. |
| Policy | Run-level Verdict | A declared decision based on results and coverage. |

Detectors and Verifiers may concern effect or cost and use hard or soft rules. Code, an LLM or an
agent can implement either role. Measurements are derived inputs to their reasoning. Findings and
judgments do not change observed execution status or become supervision for the same run.

Keep source action failures, business outcomes and evaluation execution states distinct. A recovered
tool error remains an observed error even when the Job completes. An evaluator exception is an
analysis error; not-applicable and missing results are not zero scores. A Detector returning no
Findings supports only its successfully inspected scope. Findings are not release gates unless a
Policy explicitly uses them; without a Policy, report an analysis rather than a release pass.

Record available, selected and successfully executed components separately, with versions, settings
and coverage. Use scoped Node references for evidence rather than positional numbers in a flattened
sequence. Batch tables use one declared grain, such as Job snapshots or Session windows; relate
those tables by identity rather than mixing their rows or denominators.

## Cost attribution

A model call may serve multiple Jobs. Several JobViews can include the same observed call with its
full original request and usage. Distinguish the cost of calls associated with a Job from the cost
exclusively attributable to it.

- Within a selected scope, count each physical observed call once by its source-scoped identity.
  Parent Operations and child calls are not separate copies of the same cost.
- Across Jobs and Sessions, deduplicate shared calls before claiming a cohort total. Different
  adapters may assign different observation IDs to the same execution; use explicit source
  correlation or state that cross-source deduplication is unresolved.
- Per-Job allocation requires a declared policy and its denominator. Allocated or estimated cost
  remains distinct from measured call usage; do not silently divide a shared call among Jobs.
- Supporting Session context outside the measured scope explains behavior without being charged
  again. Do not split a recorded prompt or usage value to manufacture Job-exclusive calls.
- Report missing usage coverage, input/output/cache usage and price provenance. Character counts
  are not billed tokens. Do not add nested or parallel durations to claim elapsed Job time;
  report summed call time and source-observed wall time separately.

Confirmed redundancy requires evidence that work repeated an established result without a needed
new check. Independent verification, changed sources or another question can justify repetition.
Count only the supported avoidable part, not all costs of the containing Job or Session. Keep
suspected low-value work and unresolved attribution visible instead of presenting them as savings.

## Interpret results

Check source/build issues, unmatched annotations, scope and measurement coverage before scores.
Then reconcile selected evaluation components with their persisted results. Check effect regression,
execution health and recovered action errors before subtler patterns, using
[Diagnosis](diagnosis.md) for prioritization and counterexamples.

Compare totals and normalized values: volume can increase spend while cost per input improves.
Preserve target (what is evaluated), category (effect/cost) and rule type as independent dimensions.
State label denominators: wrong-label share among reviewed results is not whole-system accuracy.
Sparse labels support only the covered conclusion; missing delivery or terminal evidence remains
unknown. Check generation versions and available model, tool, feature and environment dimensions
when comparing cohorts; a Dataset or evaluator version does not identify the agent that ran. Separate observed causes, plausible explanations and disconfirming evidence in the report.

## Controlled experiments

Optimizing the agent fixes the Case/input workload and evaluation semantics, then generates separate
observations for each configuration. Align cohorts by stable business input identity. Fixing the
same Dataset instead is appropriate for comparing evaluators, measurement rules or rendering.
Source facts, annotations and evaluation versions must remain distinguishable in both cases.

For continuous agents, control or disclose preceding context, memory, resume state, input order and
concurrency as well as model, prompt/skill, tools, compact and orchestration configuration. The same
new input alone does not establish equivalent starting conditions. Record repeats and variability
when stochastic outcomes affect the conclusion. Evaluation-model cost is separate from agent cost.

For a deterministic adapter, result filter, output compressor or partitioner, first replay identical
captured inputs through both versions. This measures the transform. If it changes what agents
observe, follow with aligned agent executions to check effect, completion and total cost.

Change one principal lever, predict the observable behavior change, choose a primary metric and
retain effect, completion and data-health guardrails. Compare whole-workload coverage even when the
number of Jobs, Sessions or turns changes; per-Session averages then describe different work.
A smaller prompt, fewer Jobs or fewer calls is not sufficient evidence of improvement. For
uncontrolled production cohorts, disclose workload and annotation differences and avoid claiming
causal version improvement from a time trend alone.

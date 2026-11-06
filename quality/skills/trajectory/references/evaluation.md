# Evaluating Session and Job behavior

Use this reference for diagnosis, Good/Fast/Cheap comparison and controlled optimization. Start from
fixed observations and the project's goals. The shared roles and result states are defined in
[Quality concepts](../../../CONCEPTS.md); subject and evidence identity are defined in
[Observation](observation.md) and [Evidence](evidence.md).

## Standardized trajectory to an optimization comparison

For an ATIF-based project, the path is: native loop recordings → standardized Trajectory →
multi-criterion evaluation → optimization-candidate selection → evidence-backed diagnosis → an
authorized optimization → evaluation of new executions on the same tasks and criteria. ATIF owns
the fact format; the project owns dimensions, rubrics, thresholds and any combined score.

Store the trajectory snapshot separately from results. Each criterion records its evaluator/rubric
version, score or verdict, applicability and source trajectory/step references. A low score selects
an investigation target; it does not establish the cause. Low-scoring bad cases are one entry:
regressions, intermittent failures, costly successful runs and issues observed through the views
can also justify investigation. Select against the project's objectives, not a universal score cutoff. Missing evidence and not-applicable are
not zero scores or passes. Inspect Session/Context/Job views without making the rendered view the
replacement source dataset. Re-scoring old facts tests evaluator changes; proving an agent change
requires new execution evidence under a controlled comparison.

## Measure Good, Fast, Cheap

Apply the [Agent triangle](../SKILL.md#good-fast-cheap-for-agents) to a declared workload and scope.
Keep the dimensions visible together instead of collapsing them into an undeclared weighted score:

- **Good:** use project criteria for correctness, completeness, evidential support and delivered
  value. For knowledge-grounded answers, check faithfulness to the source and unsupported or
  fabricated claims. Record independent judgment and annotation coverage; an agent's self-assessment
  or an intermediate review is not automatically ground truth. Finding count and successful tool status
  alone do not measure quality. Precision needs adjudicated outputs; recall also needs evidence
  about relevant omissions. When effect falls short, follow
  [effect diagnosis](diagnosis.md#trace-effect-loss-to-its-cause) to locate the deviation and explain
  its cause; outcome scores alone cannot identify which decision or mechanism needs changing.
- **Fast:** measure elapsed time to the required outcome, with observed start and end boundaries.
  For interactive answers, measure from user submission to the first visible answer token and
  to the complete answer, separating these from time to first useful response. Provider-side
  time to first token does not establish user-visible latency; record the observation boundary.
  Use waits, retries and recorded dependencies to explain the critical path; concurrent call
  durations cannot simply be summed. If task completion is unobserved, report the observed interval rather than a completed
  task latency; an open Session alone does not imply an unfinished Job. Report completion coverage
  beside latency so early failures do not appear as speed improvements.
- **Cheap:** report model-call counts, tool-call counts and tool rounds per request or task,
  input/output/cache token usage and other metered resources. Define a tool round when reported;
  one round may contain multiple parallel calls.
  Preserve provider semantics for overlapping token fields and price/version provenance for money.
  Fewer tokens need not mean lower spend across models or cache policies. Keep missing usage and
  unknown charges visible; use the attribution rules below for shared work and aggregate cost.

Efficiency asks whether time and resources were justified by their contribution. High consumption
identifies an investigation target, not waste. For example, verification may improve Good at a
Fast/Cheap cost; concurrent verification may improve Fast while increasing cost; fixing repeated
failed tool calls may improve all three. These are hypotheses until compared on equivalent work.
Saving resources is itself a valid objective, with explicit effect and completion guardrails.

For a Session, examine context use, decisions, errors, repeated work and progress for the inputs it
serves. For a Job, examine the goal, admitted work, division of labor, handoffs, aggregation and
result delivery. An open continuous Session is not a failed Job; a completed Job is not proof its
result is correct. Deliberate silence, recorded understanding or delegation can be valid outcomes
under the project's criterion. An absent output alone cannot establish that criterion was met.

Follow result problems into relevant Session calls and Context Views. Follow suspicious prompt
organization or Session behavior back to Job goals and consequences where explicit links exist.
Evidence acquired, present in an actual request, cited in an answer and verified to support a claim
are distinct observations. A cumulative acquisition receipt does not establish current visibility
or support; visible evidence does not establish that the model used it correctly. Missing links
constrain attribution; useful analysis of the available view can still proceed.

## Evaluation roles and evidence

Define Good from the business goal before choosing an evaluator. **Golden metrics are
business-specific:** customer support may prioritize correct issue resolution, while code review
may prioritize valid, actionable findings and coverage of relevant defects. Shared dimensions such
as correctness and completeness are prompts for defining criteria, not a universal metric set.
The consuming project owns its criteria, references, thresholds and any aggregation policy.

A **Rubric** makes those criteria judgeable: specify the evaluated outcome or process behavior,
what counts as meeting, partly meeting or failing the criterion, and the evidence needed for each
judgment. Keep insufficient evidence distinct from failure and not-applicable. Preserve individual
criteria and any critical failure rules; weighted totals are optional and require an explicit
business policy. AI can draft a rubric, but domain review and representative examples and
counterexamples should establish whether it reflects the intended behavior.

Use code for criteria that can be checked deterministically and semantic judgment where needed;
an LLM judge is not inherently more accurate. Record rubric and evaluator versions separately from
the agent generation and Dataset versions. Repeated judging can reveal variability but does not
remove systematic bias. A rubric explains which criterion fell short; use
[dependency-based diagnosis](diagnosis.md#trace-effect-loss-to-its-cause) to investigate where and
why that deviation arose and escaped correction.

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
observe, follow with aligned agent executions to check effect, elapsed time, completion and total cost.

Change one principal lever and predict the observable behavior change. Choose a primary Good,
Fast or Cheap metric and state acceptable bounds for the other dimensions, completion and data
health. Report all three changes, including unmeasured dimensions. An improvement without measured
regressions can dominate the baseline on the measured dimensions; a trade-off needs the project's
priorities or budgets to justify it. Compare whole-workload coverage even when the number of Jobs,
Sessions or turns changes; per-Session averages then describe different work. A smaller prompt,
fewer Jobs or fewer calls can also reflect unfinished or omitted work. For uncontrolled production
cohorts, disclose workload and annotation differences and avoid claiming causal version improvement
from a time trend alone.

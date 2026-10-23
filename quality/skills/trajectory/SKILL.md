---
name: trajectory
description: Discover, run, interpret, and iteratively tune a project's existing agent trajectory evaluation capability. Use when the user asks to inspect a loop view or agent view (看下 loop view / agent view), evaluate agent trajectories, compare effect and cost across runs, find trajectory smells or the next trajectory problem, or identify optimizations for a known trajectory issue. Operate project-owned trajectory evidence and canonical entrypoints; do not invent missing evidence, verdicts, or a parallel evaluation framework.
---

# Trajectory Quality

Analyze an agent's recorded decisions and actions to explain failures, identify avoidable
overhead, and connect each conclusion to execution evidence. Every analysis should produce
a useful diagnosis, whether or not optimization follows. Operate the project's existing
trajectory capability; do not replace its framework, business data, labels, or judgment criteria.

Read [Quality concepts](../../CONCEPTS.md) before discovery or interpretation. It defines ownership,
subject identity, execution facts, evaluation, comparison, and result states shared by the skills.

The project owns recording sources, loaders, annotations, Detectors, Verifiers, Measurers, report
projection, and optimization targets. Trajectory and deterministically derived Measurements are
inputs to discovery and verification. A Detector discovers patterns; a Verifier checks an explicit
criterion. Both can concern cost or effect and use hard or soft rules. Map the project's native
component names to these roles without assuming that a specific API or artifact exists.

Require either a usable project entrypoint that produces trajectory evidence or existing evidence
sufficient for the requested analysis. A missing specialized Detector or Verifier alone does not
make the capability absent: inspect representative and counterexample trajectories for candidate
problems, clearly recording them as analyst observations rather than fabricated framework results.

For requests such as “看下 loop view”, “看下 agent view”, or inspecting a framework session's
agent execution, read [references/loop.md](references/loop.md) first. Resolve the business execution,
its agent loops, and their session evidence, then present the requested loop view before proposing
quality improvements.

## Method: efficiency and effectiveness

Inspect trajectories through two entry points:

- **Efficiency (`cost`)**: excessive time or tokens, repeated work, unnecessary
  calls, and unproductive exploration. Many signals can be detected with little
  business knowledge.
- **Effectiveness (`effect`)**: missed objectives, incorrect conclusions, weak
  evidence, and incomplete outcomes. Judging these usually requires project-owned
  goals, contracts, or annotations. Completion and protocol checks can still be
  generic.

Business dependence is a matter of degree. High cost alone does not establish
waste; judging whether an action was worthwhile requires its contribution to
the task. One behavior can harm both efficiency and effectiveness.

Use this analysis workflow:

1. Establish the requested scope, source identity, execution health, and evidence coverage.
   Check comparability when comparing runs.
2. Identify failed objectives, incomplete outcomes, and action errors, including failures
   followed by successful retries or recovery.
3. Inspect costly or repeated work for avoidable overhead, including in successful trajectories.
   Assess what evidence, decision, or task progress the work contributed.
4. Connect each material issue to its execution records, observed impact, and supported causal
   explanation. Distinguish confirmed causes from hypotheses and note counter-evidence.
5. Summarize failure causes, redundant overhead, and unresolved questions within the analyzed
   scope. Quantify occurrence and impact where the evidence supports it.

Optimization planning and experiments are follow-up activities when requested; they are not
required to complete an analysis.

For each suspicious step, ask:

- What new evidence or decision did it produce?
- How did that advance the task's objective?
- Could it be removed, combined, or moved earlier without harming the outcome?

## Discover the capability

Read the project's AGENTS.md and README first, then locate:

- the canonical command for collecting, building, evaluating, or reporting trajectories;
- persisted Dataset, Run, Worksheet, Verdict, JSON, or HTML artifacts;
- source identity and Dataset versioning;
- the generation provenance for each trajectory, including the agent revision, instruction/skill
  version, exposed tool-contract version, loop/compact configuration, model, and orchestration when
  those can affect behavior;
- human or external annotations and their coverage;
- the available Detectors whose `detect` operations return zero or more Findings, Verifiers for
  effect or contract judgments, and Measurers for factual values such as cost;
- the component specs and configuration actually selected by the requested Run, plus each
  component's execution status, output, and coverage;
- comparison baselines, experiment configuration, and project-local operating notes.

Keep three component states separate: available in the repository, selected for this Run, and
successfully executed with usable output. A definition found in source does not prove that the
current Run used it or that it covers the relevant trajectories.

Classify the requested action using the shared capability states. Report ambiguity when multiple
plausible entrypoints remain; do not guess. Missing labels, history, usage data, a dedicated
Detector or Verifier, or a verdict policy may limit a comparison without making an otherwise valid
analysis run disappear.

## Run and interpret

Use the project-owned entrypoint and preserve the requested revision, Dataset, model configuration,
generation provenance, and environment. Do not recollect or rebuild data when the user only asks to
inspect an existing run.

Interpret artifacts in this order:

1. Check source freshness, build issues, unmatched annotations, execution coverage, measurement
   coverage, and cohort comparability.
2. Reconcile the Run's selected Detector, Verifier, and Measurer specs with persisted results.
   Report components that were configured but did not run, returned errors, were not applicable, or
   produced partial coverage.
3. Check effect regression across generator versions before subtler smells. Do not confuse the
   Dataset version or Verifier version with the identity of the agent configuration that generated
   a trajectory.
4. Apply the shared distinction among Findings, Evaluations, and Measurements. Read Verifier
   results as criterion judgments and `DetectionResult`, when present, as the execution envelope
   around zero or more Findings; neither an envelope nor a discovered pattern is a release gate.
5. Compare both totals and normalized values. Volume can increase total token or time while unit
   cost improves, and the reverse can also happen.
6. Preserve the project's dimensions. `target` identifies what is evaluated; `category` identifies
   a concern such as quality or cost.
7. State every label denominator. A wrong-label share among reviewed samples is not whole-system
   accuracy, and sparse annotations only support a directional conclusion.
8. Treat `skipped`, `error`, incomplete execution, and missing policy as distinct states. An
   analysis-only run can be useful, but it is not a passing release gate.

## Find and tune

- To diagnose failures, investigate redundant overhead, or find trajectory smells, read
  [references/problem-discovery.md](references/problem-discovery.md) completely.
  Use its prioritization guidance when the user asks what to optimize next.
- When evidence points to objectives, policy, evidence standards, or instructions, read
  [references/system-prompt.md](references/system-prompt.md) completely.
- When evidence points to capability selection or a tool's name, description, arguments,
  granularity, execution, or result, read [references/tool.md](references/tool.md) completely.
- To analyze turn progress, budgets, retries, concurrency, state, termination, task partitioning,
  cross-loop handoff, or compact, read [references/loop.md](references/loop.md) completely.
- For prompt growth, context retention, or token-related latency, read
  [references/context-management.md](references/context-management.md) completely.

Do not map an aggregate label or smell directly to a fix. First identify the repeated trajectory
behavior, then use its evidence and counterexamples to choose the system-prompt, tool-contract,
loop, compact, model, or orchestration surface.

Start with the framework's quantified signals, step-level evidence, and accumulated history. Prefer
an existing Finding when it captures the behavior. When no Detector covers a repeated pattern,
record a candidate smell with representative and counterexample trajectories; do not manufacture a
`DetectionResult` or Verdict. Suggest a reusable project Detector only after the pattern can be
reproduced and stated independently of its assumed cause.

### Follow-up tuning

Apply the experiment guidance below when optimization is requested. Preserve the diagnosis
as a separate result: selecting one problem for an experiment must not discard other material
issues found during analysis.

For an agent change, freeze the same Case/input workload and evaluation semantics, then let each
generation configuration produce its own Trajectories. Align the resulting cohorts by stable Case or
input identity; do not pretend that changed observations are the same TrajectoryDataset. Reuse one
fixed TrajectoryDataset only when comparing Detectors, Verifiers, Measurers, policies, or report
projections.

Benchmark a deterministic adapter, result filter, CLI output compressor, or other pure transform by
replaying the same captured inputs through both versions. Do not use two stochastic end-to-end
agent runs to claim the component's reduction. If the transform changes what the agent observes,
follow the component benchmark with aligned Case/input trajectory cohorts to check effect and
completion.

Change one principal agent lever at a time, record the generation provenance, define one primary
metric plus effect and health guardrails, and compare the aligned cohorts. Lower cost is an
improvement only when effect and completion do not regress.

Assessment is read-only. Propose changes to prompts, tools, agent loops, orchestration, models, or
evaluation assets; implement them only when the user asks for that mutation.

## Report and retain learning

Lead with the diagnostic conclusions. Every trajectory analysis must explicitly address:

- **Failures and causes:** unmet objectives, incomplete delivery, and action errors, including
  failures hidden by later recovery. Explain supported causes and distinguish observed failures
  from causal hypotheses.
- **Redundant overhead:** repeated or low-value work whose contribution does not justify its
  cost. Report occurrence counts, affected scope, and attributable calls, tokens, time, or
  monetary cost where available. High consumption alone is not evidence of waste.
- **Execution evidence:** link each material conclusion to native run/trajectory identities
  and relevant turns, calls, events, or source ranges. Include the key inputs, actual outputs,
  and subsequent actions needed to understand the conclusion.

For each issue, state the observed behavior, outcome or cost impact, causal explanation,
evidence location, and uncertainty. Group repeated instances into patterns while retaining
representative examples and relevant counterexamples. Label analyst observations separately
from framework-produced Findings and Verifier judgments.

Distinguish confirmed redundancy, suspected low-value work, and unresolved cost attribution.
Do not attribute an entire trajectory's cost to one redundant step or present estimated
avoidable cost as measured savings.

Explicitly distinguish "none found within the inspected scope" from "insufficient evidence."
A successful final outcome does not establish an error-free or efficient execution.

Include the project and revision, source/Dataset identity, generation provenance, relevant
runs, data health, selected evaluation components and their execution coverage, measurement
coverage, and artifact paths as applicable. State the inspected scope and denominators;
keep detailed execution records in linked drill-down artifacts.

When optimization is requested, add the next prioritized problem, proposed change surface,
and experiment separately. For view-only requests, lead with the requested loop view and
keep accompanying diagnostic observations proportional to the inspected evidence.

Persist evidence and reusable operating knowledge beside the project's evaluation assets under the
shared provenance and privacy rules. Promote a problem pattern or optimization tactic into this
skill's references only after it proves reusable across projects.

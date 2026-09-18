---
name: trajectory
description: Discover, run, interpret, and iteratively tune a project's existing agent trajectory evaluation capability. Use when the user asks to evaluate agent trajectories, compare effect and cost across runs, find trajectory smells or the next trajectory problem, or identify optimizations for a known trajectory issue. Operate project-owned trajectory evidence and canonical entrypoints; do not invent missing evidence, verdicts, or a parallel evaluation framework.
---

# Trajectory Quality

Turn an agent's recorded decisions and actions into an evidence-backed next improvement. Operate the
project's existing trajectory capability; do not replace its framework, business data, labels, or
judgment criteria.

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

- To find trajectory smells and select the next evidence-backed problem, read
  [references/problem-discovery.md](references/problem-discovery.md) completely.
- When evidence points to objectives, policy, evidence standards, or instructions, read
  [references/system-prompt.md](references/system-prompt.md) completely.
- When evidence points to capability selection or a tool's name, description, arguments,
  granularity, execution, or result, read [references/tool.md](references/tool.md) completely.
- When evidence points to budgets, retries, concurrency, state, termination, orchestration, or
  compact, read [references/loop-mechanism.md](references/loop-mechanism.md) completely.

Do not map an aggregate label or smell directly to a fix. First identify the repeated trajectory
behavior, then use its evidence and counterexamples to choose the system-prompt, tool-contract,
loop, compact, model, or orchestration surface.

Start with the framework's quantified signals, step-level evidence, and accumulated history. Prefer
an existing Finding when it captures the behavior. When no Detector covers a repeated pattern,
record a candidate smell with representative and counterexample trajectories; do not manufacture a
`DetectionResult` or Verdict. Suggest a reusable project Detector only after the pattern can be
reproduced and stated independently of its assumed cause.

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

Report the evaluated project and revision, Dataset identity, current and comparison generation
provenance and runs, data health, the available and actually selected Detectors, Verifiers, and
Measurers with their execution coverage, quantified effect and cost, the exact evidence location,
selected Findings and Verifier judgments, the next prioritized problem and change surface,
supporting Worksheet examples, unknowns, and artifact paths. Lead with the decision-relevant
summary; keep per-trajectory evidence in drill-down artifacts.

Persist evidence and reusable operating knowledge beside the project's evaluation assets under the
shared provenance and privacy rules. Promote a problem pattern or optimization tactic into this
skill's references only after it proves reusable across projects.

---
name: trajectory
description: Discover, run, interpret, and iteratively tune a project's existing agent trajectory evaluation capability. Use when the user asks to evaluate agent trajectories, compare effect and cost across runs, find trajectory smells or the next trajectory problem, or identify optimizations for a known trajectory issue. Operate project-owned trajectory evidence and canonical entrypoints; do not invent missing evidence, verdicts, or a parallel evaluation framework.
---

# Trajectory Quality

Turn an agent's recorded decisions and actions into an evidence-backed next improvement. Operate the
project's existing trajectory capability; do not replace its framework, business data, labels, or
judgment criteria.

## Keep the owners separate

1. Treat case-harness or another trajectory framework as infrastructure that quantifies and
   localizes trajectory problems, then accumulates their evidence through normalization, Dataset
   and Run artifacts, Findings, Evaluations, Measurements, Worksheets, metrics, and reports.
2. Treat the project as owner of its RecordingSource, Loader, annotations, Detectors, Evaluators,
   Measurers, report projection, canonical command, and optimization targets.
3. Treat this skill as the operator that discovers those assets, runs them, turns their evidence into
   one bounded next problem and change surface, and organizes a controlled tuning experiment.

The framework answers where a problem appears, with what evidence, magnitude, and trend. This skill
uses project context to decide what to change next and how to verify it.

Do not call a lower-level framework directly when the project exposes a wrapper. Framework code
alone is `no_capability`; require either a usable project entrypoint that can produce trajectory
evidence or an existing project-owned artifact sufficient for the requested analysis. A missing
specialized Detector or Evaluator alone is not `no_capability`: when normalized trajectories are
available, inspect representative and counterexample rows for an open-ended candidate problem.
Record it as project evidence, not as a fabricated framework result or Verdict.

## Discover the capability

Read the project's AGENTS.md and README first, then locate:

- the canonical command for collecting, building, evaluating, or reporting trajectories;
- persisted Dataset, Run, Worksheet, Verdict, JSON, or HTML artifacts;
- source identity and Dataset versioning;
- the generation provenance for each trajectory, including the agent revision, instruction/skill
  version, exposed tool-contract version, loop/compact configuration, model, and orchestration when
  those can affect behavior;
- human or external annotations and their coverage;
- the available Detectors whose `detect` operations return zero or more Findings, Evaluators for
  effect or contract judgments, and Measurers for factual values such as cost;
- the component specs and configuration actually selected by the requested Run, plus each
  component's execution status, output, and coverage;
- comparison baselines, experiment configuration, and project-local operating notes.

Keep three component states separate: available in the repository, selected for this Run, and
successfully executed with usable output. A definition found in source does not prove that the
current Run used it or that it covers the relevant trajectories.

Classify discovery as `ready`, `blocked`, or `no_capability`. Report ambiguity when multiple
plausible entrypoints remain; do not guess. Missing labels, history, usage data, a dedicated
Detector or Evaluator, or a verdict policy may limit a comparison without making an otherwise valid
analysis run disappear.

## Run and interpret

Use the project-owned entrypoint and preserve the requested revision, Dataset, model configuration,
generation provenance, and environment. Do not recollect or rebuild data when the user only asks to
inspect an existing run.

Interpret artifacts in this order:

1. Check source freshness, build issues, unmatched annotations, execution coverage, measurement
   coverage, and cohort comparability.
2. Reconcile the Run's selected Detector, Evaluator, and Measurer specs with persisted results.
   Report components that were configured but did not run, returned errors, were not applicable, or
   produced partial coverage.
3. Check effect regression across generator versions before subtler smells. Do not confuse the
   Dataset version or Evaluator version with the identity of the agent configuration that generated
   a trajectory.
4. Read Findings, Evaluations, and Measurements separately. A Finding is the output of `detect` and
   describes a behavior pattern without implying a verdict; an Evaluation is a contract or effect
   judgment; a Measurement is a factual value. A `DetectionResult`, when present, is only the
   Detector's execution envelope around zero or more Findings.
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
fixed TrajectoryDataset only when comparing Detectors, Evaluators, Measurers, policies, or report
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
provenance and runs, data health, the available and actually selected Detectors, Evaluators, and
Measurers with their execution coverage, quantified effect and cost, the exact evidence location,
selected Findings and Evaluator judgments, the next prioritized problem and change surface,
supporting Worksheet examples, unknowns, and artifact paths. Lead with the decision-relevant
summary; keep per-trajectory evidence in drill-down artifacts.

Persist run-specific evidence and project-specific lessons beside the project's evaluation assets.
Promote a problem pattern or optimization tactic into this skill's references only after it proves
reusable across projects. Do not copy private samples, volatile weekly numbers, credentials, or
project-only commands into the plugin.

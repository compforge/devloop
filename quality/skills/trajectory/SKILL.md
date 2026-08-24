---
name: trajectory
description: Discover, run, interpret, and iteratively tune a project's existing agent trajectory evaluation capability. Use when the user asks to evaluate agent trajectories, compare effect and cost across runs, find trajectory smells or the next trajectory problem, or identify optimizations for a known trajectory issue. Follow project-owned data sources, evaluators, measurements, and entrypoints; do not invent a missing evaluation capability.
---

# Trajectory Quality

Evaluate and tune an agent from its recorded decisions and actions. Operate the project's existing
trajectory capability; do not replace its framework, business data, labels, or judgment criteria.

## Keep the owners separate

1. Treat case-harness or another trajectory framework as infrastructure for normalization, Dataset,
   Evaluation, Measurement, Worksheet, metrics, and reports.
2. Treat the project as owner of its RecordingSource, Loader, annotations, Evaluators, Measurers,
   report projection, canonical command, and optimization targets.
3. Treat this skill as the operator that discovers those assets, runs them, interprets evidence, and
   organizes controlled tuning experiments.

Do not call a lower-level framework directly when the project exposes a wrapper. Framework code
without project-owned trajectory data and evaluation logic is `no_capability`.

## Discover the capability

Read the project's AGENTS.md and README first, then locate:

- the canonical command for collecting, building, evaluating, or reporting trajectories;
- persisted Dataset, Run, Worksheet, Verdict, JSON, or HTML artifacts;
- source identity and Dataset versioning;
- human or external annotations and their coverage;
- Evaluators for effect and Measurers for cost;
- comparison baselines, experiment configuration, and project-local operating notes.

Classify discovery as `ready`, `blocked`, or `no_capability`. Report ambiguity when multiple
plausible entrypoints remain; do not guess. Missing labels, history, usage data, or a verdict policy
may limit a comparison without making an otherwise valid analysis run disappear.

## Run and interpret

Use the project-owned entrypoint and preserve the requested revision, Dataset, model configuration,
and environment. Do not recollect or rebuild data when the user only asks to inspect an existing
run.

Interpret artifacts in this order:

1. Check source freshness, build issues, unmatched annotations, execution coverage, measurement
   coverage, and cohort comparability.
2. Read effect and cost separately. Evaluation is a judgment; Measurement is a factual value.
3. Compare both totals and normalized values. Volume can increase total token or time while unit
   cost improves, and the reverse can also happen.
4. Preserve the project's dimensions. `target` identifies what is evaluated; `category` identifies
   a concern such as quality or cost.
5. State every label denominator. A wrong-label share among reviewed samples is not whole-system
   accuracy, and sparse annotations only support a directional conclusion.
6. Treat `skipped`, `error`, incomplete execution, and missing policy as distinct states. An
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

Freeze a reusable Dataset before comparing an agent change. Change one principal lever at a time,
record the configuration and code identity, define one primary metric plus effect and health
guardrails, then rerun the same Dataset. Lower cost is an improvement only when effect and
completion do not regress.

Assessment is read-only. Propose changes to prompts, tools, agent loops, orchestration, models, or
evaluation assets; implement them only when the user asks for that mutation.

## Report and retain learning

Report the evaluated project and revision, Dataset identity, current and comparison runs, data
health, effect, cost, the next prioritized smell or problem, supporting Worksheet examples,
unknowns, and artifact paths. Lead with the decision-relevant summary; keep per-trajectory evidence
in drill-down artifacts.

Persist run-specific evidence and project-specific lessons beside the project's evaluation assets.
Promote a problem pattern or optimization tactic into this skill's references only after it proves
reusable across projects. Do not copy private samples, volatile weekly numbers, credentials, or
project-only commands into the plugin.

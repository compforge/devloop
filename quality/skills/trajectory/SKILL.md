---
name: trajectory
description: Present SessionView as text in conversation or TUI (including loop view / agent view requests), inspect JobView observations, show Context View text outlines of prompts to spot possible prompt issues, diagnose agent failures and avoidable work, compare effect and cost, and design evidence-backed optimization experiments. Use project-owned recordings and evaluation entrypoints; do not invent missing evidence or judgments.
---

# Trajectory Quality

Evaluate how agents pursue goals through recorded observations, decisions and actions. Use
SessionView to follow an Agent Session and JobView to follow business work across Sessions.
Connect outcomes to the calls and context that explain them. Every diagnosis addresses failures,
redundant overhead and execution evidence; optimization is a separate, requested activity.

Read [Quality concepts](../../CONCEPTS.md) and [Observation](references/observation.md) to establish
the subject and evidence model. Trajectory names the behavior under analysis; SessionView and
JobView provide its shared observation structures. The project owns business goals, Job membership,
annotations, evaluation criteria and its canonical commands. The skill operates those capabilities
and explains their evidence.

## Choose the action and perspective

| Request | Action and reading |
|---|---|
| Show a SessionView, loop view or agent view | Present the SessionView as text in conversation/TUI using [SessionView text rendering](references/observation.md#sessionview-text-rendering). |
| Show a Context View | Show a text prompt outline by message role, expanding complex messages into their component sections to spot possible prompt issues; use [Context View](references/observation.md#context-view). |
| Show a JobView | Inspect the task snapshot using [Observation](references/observation.md); lead with its goal, work and result. |
| Find why a task failed or an agent repeated work | Read [Evidence](references/evidence.md), [Evaluation](references/evaluation.md) and [Diagnosis](references/diagnosis.md). |
| Compare results or versions | Read [Evidence](references/evidence.md) and the comparison rules in [Evaluation](references/evaluation.md). |
| Optimize an evidenced problem | Preserve the diagnosis, then select a mechanism reference below and define a controlled experiment. |

“Loop view” and “agent view” are request phrases for viewing a SessionView. Choose text for
conversation/TUI; use HTML or another artifact format when requested. SessionView preserves actual
request structure; Context View summarizes prompt composition for inspection.

A Job question starts from goals, progress and outcomes, then follows relevant calls into their
Sessions. A Session question starts from continuity, context and actions, then checks their
contribution to Jobs where business links exist. Both perspectives support effect and cost analysis.
A usable single perspective is enough for a bounded analysis; report missing relationships instead
of inventing them or requiring the other view.

## Establish inputs and capability

Read the project's AGENTS.md and README, then discover its canonical observation and evaluation
entrypoints, source readers, saved artifacts and operating notes. Apply [Evidence](references/evidence.md)
when selecting or collecting evidence. Locate:

- the selected Session/Job identities, snapshot versions, scope and source references;
- business goals, recorded outcomes, independent annotations and their coverage;
- generation provenance: agent revision, instructions/skills, exposed tools, model, loop/compact
  and orchestration configuration when they affect behavior;
- available Measurers, Detectors, Verifiers and policies, plus the components actually selected
  and successfully executed in the evaluation being inspected;
- saved Dataset, evaluation results, reports, baselines and comparison cohorts when available.

Require a usable project entrypoint or sufficient existing evidence. Framework presence alone does
not establish coverage. Missing labels, usage or specialized evaluators may limit a conclusion
without preventing useful analysis. Use the shared capability states and state the specific gap.
If several plausible subjects or entrypoints remain after discovery, clarify the ambiguity.

Inspecting a saved result does not authorize recollection, reevaluation or rerunning the agent.
Preserve the requested revision, evidence and environment. Check actual installed APIs before
invoking them; the observation model is not a promise that every project exposes the same command.

## Analyze

Use [Evaluation](references/evaluation.md) for assessment and comparison:

1. Fix the subject, snapshot and analysis scope; check source health and applicable evidence.
2. Identify unmet goals, incomplete outcomes and action errors, including recovered failures.
3. Inspect costly or repeated work, including successful executions. Ask what evidence, decision
   or task progress each suspicious action contributed.
4. Follow explicit Job/Session links to explain the behavior. Preserve contrary evidence and
   distinguish confirmed causes from hypotheses.
5. Quantify occurrence and impact within the supported scope, then report the diagnosis.

The project may supply automated evaluation components. A missing Detector does not prevent an
analyst from inspecting representative and counterexample executions; label those observations
separately from framework-produced Findings and judgments. A reusable Detector is appropriate when
a pattern can be reproduced and stated independently of its assumed cause.

## Diagnose mechanisms and tune

Read the relevant reference completely when evidence points to its subject:

- [Diagnosis](references/diagnosis.md): prioritize failures, effect regressions,
  redundant work and trajectory smells; choose one next problem when requested.
- [Instructions](references/instructions.md): objectives, policy, instructions and evidence standards.
- [Tools](references/tools.md): capability selection, contracts, granularity, execution and observations.
- [Agent loops](references/loop.md): progress, budgets, retries, recovery, termination, concurrency
  and cross-Agent handoffs.
- [Context management](references/context.md): request growth, retention, compact and cost.

An aggregate label or smell does not prescribe a fix. Use evidence and counterexamples to select
its owner and change surface. For experiments, follow [Evaluation](references/evaluation.md#controlled-experiments):
change one principal lever, preserve the input workload and evaluation criteria, and compare effect,
completion and cost. Selecting one experiment must not discard other material diagnostic findings.
Assessment is read-only; changing agent behavior or evaluation assets requires the user's request.

## Report and retain learning

Lead with diagnostic conclusions. Every analysis explicitly addresses:

- **Failures and causes:** unmet objectives, incomplete delivery and action errors, including
  failures hidden by recovery. Separate observed failure from causal hypotheses.
- **Redundant overhead:** work whose contribution does not justify its cost. State occurrence,
  affected scope, attributable calls/tokens/time/cost and uncertainty where evidence supports them.
- **Execution evidence:** link each conclusion to its Session/Job snapshot, scoped Node references
  and native records. Show the key inputs, actual outputs and subsequent actions.

For each issue, explain the observed behavior, effect or cost impact, supported cause, evidence
location and uncertainty. Retain representative examples and counterexamples. Distinguish confirmed
redundancy, suspected low-value work and unresolved attribution; estimated avoidable cost is not
measured savings. A successful final outcome does not establish efficient or error-free execution.

Include subject and generator revisions, evidence versions, time/input scope, selected evaluation
components, execution and measurement coverage, denominators and artifact paths as applicable.
Keep detailed records in linked drill-down artifacts. Say whether no problem was found within the
inspected scope or the evidence was insufficient. Without a declared gate policy, analysis is not
a release pass.

For view-only requests, lead with the requested view and keep diagnosis proportional to the evidence.
For optimization requests, add the prioritized problem, change surface and experiment separately.
Persist evidence and reusable operating knowledge beside project evaluation assets under the shared
provenance and privacy rules. Promote patterns into this skill only after they prove reusable.

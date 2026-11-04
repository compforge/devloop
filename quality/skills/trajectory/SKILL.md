---
name: trajectory
description: Present SessionView as text in conversation or TUI (including loop view / agent view requests), inspect JobView observations, show Context View text outlines of prompts to spot possible prompt issues, diagnose agent failures and avoidable work, assess Good, Fast, Cheap for agents (effect, speed and cost), and design evidence-backed optimization experiments. Use project-owned recordings and evaluation entrypoints; do not invent missing evidence or judgments.
---

# Trajectory Quality

Make agent execution observable to people and improve it through evidence-backed evaluation.
Use one operating model: recorded execution facts support both human supervision and a measured
improvement loop. Every diagnosis addresses failures, redundant overhead and execution evidence;
changing behavior remains a separate, requested activity.

## Operating model

Organize the work into **Execution / Observation / Improvement（执行 / 观察 / 改进）**:

- **Execution:** business orchestration and the agent framework/harness run loops, model calls
  and tool calls, producing recorded facts.
- **Observation:** Job, Session and Context views make those facts visible to people for supervision.
- **Improvement:** evaluate Good/Fast/Cheap, select candidates, diagnose, optimize and verify with
  new execution evidence. Trajectory Harness supports this analysis; it is distinct from the
  agent's execution framework/harness.

```text
agent execution -> recorded facts
  |-> Job / Session / Context views -> human observation and supervision
  |-> Good / Fast / Cheap evaluation -> candidates -> diagnosis
        -> authorized optimization -> new execution -> controlled comparison
```

The views work primarily at the presentation layer: make business progress, agent actions and
request context visible, understandable and traceable to people. SessionView and JobView are
structured read models for rendering; text/TUI and Web are surfaces. Views and evaluation results
connect through evidence references: a person can drill down from a score or notice an issue the
evaluators do not yet cover. Viewing does not require scoring, and scoring does not require rendering.

Trajectory names execution history; ATIF is an industry interchange standard for those facts, not
the only format. In an ATIF-based project, Trajectory is the standardized fact and evaluation input.
Store scores separately with their criteria and source evidence; do not write judgments into facts.

- Actual model-request message list → Context View, including tool definitions outside messages.
- Loop execution → ATIF Trajectory → SessionView, for projects using ATIF.
- Business work across one or more loops and deterministic operations → JobView.

A Session may contain several loop trajectories; a Job may use only part of a shared loop. Preserve
explicit identities and call attribution rather than assuming one-to-one relationships. Read
[Quality concepts](../../CONCEPTS.md) and [facts and views](references/observation.md#facts-and-view-projections)
for the subject and evidence boundaries.

Good, Fast and Cheap mean quality/effect, speed and cost. Low-scoring bad cases are one way to
select candidates; regressions, intermittent failures, expensive successful runs and human
observations can also reveal useful targets. High usage or a low score alone does not establish a
cause. Diagnose before selecting a mechanism, then compare new executions on the same workload
and criteria, keeping completion and evidence coverage visible.

| Responsibility | What it contributes |
|---|---|
| This skill | Overall guidance: observe, evaluate, select, diagnose, optimize and verify. |
| Trajectory Harness | Engineering support: standardization, fixed datasets, repeatable evaluators, evidence-linked results, view exports and reports. |
| A consuming project, such as CCR | Real recordings, domain criteria, adapters and reproducible cases demonstrating whether a change worked. |

Existing sufficient evidence can support analysis without a particular SDK. Keep business criteria
and tool names in the project. Promote mechanisms into Harness and methods into this skill when
practice establishes their reuse; do not generalize an unverified case into a universal rule.

## Good, Fast, Cheap for agents

Use the **Agent 效果—速度—成本铁三角** (Agent Good–Fast–Cheap triangle) to ask whether the agent
did the work well, how long it took and what resources it consumed:

| Dimension | Agent question | Evidence to inspect |
|---|---|---|
| **Good — effect** | Did it achieve the goal correctly, sufficiently and usefully? Where did it depart from that goal, and why? | Expected versus delivered results, independent checks, and the decisions, context and actions behind a deviation. |
| **Fast — speed** | How long until the required result was delivered? | Elapsed task time, useful response milestones, waits, retries and the critical path where recorded. |
| **Cheap — cost** | What did that result consume? | Model/tool calls, input/output/cache usage, compute and monetary cost under known metering and prices. |

Measure the three together on the same work and outcome coverage. A quick incorrect answer or
an early abort can reduce time and tokens without improving the agent. Extra verification may be
worth its cost; parallel work may reduce elapsed time while increasing spend. Removing ineffective
work can improve all three: the triangle frames trade-offs, not a law that only two can improve.
Use [Evaluation](references/evaluation.md) for measurement and comparison rules. Keep unavailable
dimensions explicit rather than inferring quality from speed or cost.

Fast and Cheap usually have direct timing and usage signals to locate bottlenecks. Good also needs
the project's intended behavior and a causal diagnosis: identify where work departed from that
intent, trace how the deviation affected the result, and explain the supported cause. Use
[effect diagnosis](references/diagnosis.md#trace-effect-loss-to-its-cause) to connect Job outcomes,
Session decisions and Context evidence; a low score alone does not locate the problem.

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
conversation/TUI; use HTML or another artifact format when requested. Context View has its own
reading task: expose prompt organization by actual message order, roles and internal sections.

A Job question starts from goals and outcomes, then follows relevant calls into their Sessions.
A Session question starts from continuity and actions, then checks contribution to Jobs. A Context
question starts from prompt composition, then follows the response and subsequent actions to
check its consequences. Use explicit identities to move among the views. All three can inform
Good, Fast, Cheap; they are not assigned one dimension each. A usable single view is enough for a
bounded analysis; report missing relationships instead of inventing them or requiring all views.

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
   For effect loss, trace backward from the affected result through its evidence and decisions,
   then follow the deviation forward to delivery. Identify where it arose and where correction
   failed, using the [dependency-based diagnosis](references/diagnosis.md#trace-effect-loss-to-its-cause).
3. Inspect costly or repeated work, including successful executions. Ask what evidence, decision
   or task progress each suspicious action contributed.
4. Follow explicit Job/Session links and inspect the relevant Context View to explain decisions.
   Distinguish evidence acquired, present in a request, cited by the agent and verified to support
   the conclusion. Preserve contrary evidence and distinguish confirmed causes from hypotheses.
5. Quantify effect, elapsed time and resource cost within the supported scope, including gaps.
   Report the diagnosis before choosing an optimization.

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
change one principal lever, preserve the input workload and evaluation criteria, and compare Good,
Fast, Cheap with completion and evidence coverage. Selecting one experiment must not discard
other material diagnostic findings.
Assessment is read-only; changing agent behavior or evaluation assets requires the user's request.

## Report and retain learning

Lead with diagnostic conclusions and the supported Good, Fast, Cheap assessment; identify unknown
dimensions and their missing evidence. Every diagnosis explicitly addresses:

- **Failures and causes:** unmet objectives, incomplete delivery and action errors, including
  failures hidden by recovery. For effect loss, show the expected behavior, observed deviation,
  propagation to the result and supported cause; distinguish unresolved links and causal hypotheses.
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

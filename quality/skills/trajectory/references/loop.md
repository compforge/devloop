# Agent loop mechanisms

Use this reference when Session or Job evidence points to budgets, retries, state, termination,
concurrency or handoffs. [Observation](observation.md) defines the SessionView and JobView inspection
model; [Evaluation](evaluation.md) defines effect/cost attribution and experiment controls.

## Progress within a Session

Follow the actual sequence of context preparation, model decision, tool execution and retained
observations. A source-recorded Turn is a useful interaction boundary when present; otherwise use
observed calls and Operations without inventing turns. Tool batches, retries and compact calls need
not be separate turns. Progress can be new evidence, reduced uncertainty, a decision, verification
or delivery. Activity alone does not establish progress.

Use the [per-turn evidence table](diagnosis.md) where native turn boundaries exist, or its
call/Operation equivalent. Inspect what the model received, what it decided, actual tool outcomes
and what survived into subsequent context. Model latency can dominate, but measure context
preparation, model and tool time before selecting a change.

Task-oriented and continuous describe how the Agent serves Jobs. Followup and steer can continue an
existing Session; resume can preserve its identity across processes. Inspect source-recorded
boundaries and the state actually retained. A Job can finish while a Session continues serving other
inputs. Track task result and delivery independently of invocation termination.

## Mechanism diagnosis and optimization

Investigate runtime mechanisms when useful or locally reasonable actions still produce waste,
lost work, timeouts, incomplete delivery, or repeated state reconstruction. Connect each signal
to its evidence before selecting a change.

Treat model family or reasoning effort as a controlled runtime experiment after checking prompt,
tool, context, and mechanism explanations.

### Budgets and termination

- **Signal:** useful exploration repeatedly times out, or consumes the budget needed for delivery.
- **Evidence:** phase durations, enclosing deadlines, remaining budget, terminal records, and
  completed work that was never delivered.
- **Direction:** allocate exploration, execution, verification, and delivery budgets; preserve valid
  partial results and support incremental delivery or anytime completion.

### Retries and convergence

- **Signal:** retry or navigation cycles continue after evidence converges, or failures disappear
  behind later successful attempts.
- **Evidence:** individual attempt outcomes, failure causes, repeated actions, and the information
  or decision gained from each attempt.
- **Direction:** retain failures as observable outcomes and bound retries/navigation using explicit
  stopping and convergence rules.

### State and recovery

- **Signal:** failures discard completed work, or phases repeatedly reconstruct stable facts and
  decisions. After compact, constraints disappear or tool selection and result quality degrade.
- **Evidence:** checkpoints, retained summaries, evidence identities, and the actions immediately
  before and after compact or recovery. Distinguish lost state from a necessary external refresh.
- **Direction:** preserve decisions, evidence references, completed work, and unresolved items;
  improve checkpoint, cache, and shared-state identity. For compact triggers, retention policies,
  and token analysis, read [context.md](context.md).

### Concurrency and orchestration

- **Signal:** independent work is serialized, or partitioning causes duplicated discovery, blocked
  waits, missing handoff context, or evidence loss during aggregation.
- **Evidence:** dependencies, scheduling/cancellation events, capacity limits, loop identities,
  handoff contents, and aggregated results.
- **Direction:** run independent work within declared capacity, timeout, and cancellation limits;
  adjust partitioning, routing, handoff, aggregation, or cross-loop deduplication at their owner.

#### Trace work across loop boundaries

When repeated work spans tasks, phases, or agents, follow the same question across those boundaries
rather than treating each trajectory in isolation. Use existing task and evidence identities to
record what was established, what remained uncertain, what the later loop actually received, and
what new evidence or decision its work produced. Missing handoff records leave availability unknown;
they do not prove that a later agent ignored available evidence.

Distinguish repeated retrieval, repeated reasoning, and repeated delivery. Reading the same source
can serve a different question; independent verification or a changed source can justify repeating
an investigation. Attribute avoidable cost only to the steps shown to repeat established work
without a required new check, not to the entire task containing them.

Before adding shared state or changing a prompt, inspect why the work was separated:

- If tasks pursue the same question with overlapping evidence, consider whether a common task
  boundary would preserve coverage and fit the execution budget.
- If separation serves independent verification, access boundaries, parallelism, or capacity,
  preserve that purpose and inspect the handoff instead. Relevant handoff content can include
  evidence references and versions, completed work, decisions, and unresolved questions; an
  independent verifier may need source evidence without the earlier conclusion.
- If the needed information reached the later loop but work still repeats, inspect how it is used
  and whether convergence or stopping rules apply.

Treat these as competing explanations. Identify the suspected boundary behind the loss or
repetition and what evidence would disprove that explanation.

### Validate the change

State the invariant the change enforces and the execution difference it predicts: fewer retries,
earlier partial delivery, concurrent independent calls, retained decisions, or bounded termination.
Record loop configuration, compact policy, model routing, and orchestration identity.

Generate from the same Case/input workload and align cohorts by stable identity. Compare completion,
retries, duplicated work, post-compact rework, total and normalized tokens, duration, tail latency,
and effect. A compact improvement must reduce complete-trajectory cost or improve completion/effect;
shrinking one prompt is insufficient. Follow the skill's effect and health guardrails when judging
any cost improvement.

When changing task boundaries, compare totals and coverage for the same original Case/input, even
if the number of tasks or loops changes. Per-task averages then describe different amounts of work
and cannot establish an improvement by themselves. Check that required work remains represented;
report omitted, unstarted, and unfinished work separately.

For deterministic partitioning or handoff preparation, use the project's native replay or dry-run
path with fixed inputs. Verify input identity and baseline output before attributing differences to
the change. Check coverage and capacity as well as the expected structural difference. This can
validate the mechanism, but fewer tasks or smaller initial context do not prove lower agent cost.
The subsequent aligned agent runs must show the predicted change in actions, alongside effect and
completion; otherwise report the structural result and the remaining uncertainty separately.

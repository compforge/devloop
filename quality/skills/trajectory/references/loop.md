# Agent loops

Use this reference to inspect an agent loop's execution or investigate its runtime mechanisms.
**Loop view** is the agent-semantic execution view; **agent view** is an accepted alias. Requests
such as “看下 loop view” or “给我看下 agent view” mean locating the execution evidence and showing
how the agent progressed through turns, model calls, tool calls, and runtime operations.

## Business execution, loop, and session

One business execution can organize several agent loops, sequentially, concurrently, or through
nested delegation. Each loop has an objective and termination conditions. For example, a code
review execution such as CCR can coordinate exploration and review loops, then aggregate their
results into a business deliverable.

An agent framework such as AgentGo provides loop execution and native session records. A session
supplies identity, history, and recorded state. Resolve the project's actual business-execution,
loop/run, and session IDs and their relationships: resumed sessions and nested execution need not
map one-to-one to loop runs. Distinguish these framework sessions from an analysis tool's loading
session.

Loop completion describes how one agent execution ended. Business completion additionally depends
on orchestration, aggregation, result persistence, and delivery. Track both when assessing quality.

## Loop view

A loop view organizes execution evidence around the agent's turns, observations, and actions.
Native session events or physical trace spans can supply the evidence. Show call content as the
primary detail, with recorded duration, token/cost values, and execution status alongside it.

### Execution structure

A minimal loop builds context, asks the model for its next action, executes tools when requested,
and retains observations for the next iteration:

```python
while not done:
    context = context_manager.build_context(query)
    llm_result = call_llm(context)
    context_manager.append(llm_result)
    if not llm_result.tool_calls:
        return llm_result.text
    tool_result = call_tool(llm_result.tool_calls)
    context_manager.append(tool_result)
    context_manager.compress_if_needed()
```

One iteration is a **turn**: an opportunity to explore and advance the task. Exploration obtains
evidence or reduces uncertainty; progress can also be a decision, an action, verification, or
final delivery. Tool activity alone does not establish progress, and a useful turn need not
retrieve new information.

This is an analysis model, not a required runtime API or stopping policy. Map turns to the project's
recorded execution; tool batches, model retries, and compression calls need not be separate turns.
Inspect what context the model actually received, what it decided, the actual tool observations,
and what remained available afterward. Use the [per-turn evidence table](problem-discovery.md)
to connect consumption to progress. Model latency can dominate, but measure context preparation,
model, and tool time before choosing an optimization; fewer turns alone do not prove improvement.

A loop run contains ordered **turns** and **operations**. A turn contains its model calls, tool
calls, and operations, using the framework's turn boundaries and ordering. Operations may also
occur before, between, or after turns. A tool call or operation can invoke a nested loop; retain
both the parent invocation and the child's own execution structure.

### ModelCall: prompt and response

Show the actual **prompt** sent to the model as an ordered **message list**, with each message's
role and content visible. For example:

```text
system: <system instructions>
user: <user request>
assistant: <prior assistant message or tool-call request>
tool: <tool result>
```

Preserve actual message order, boundaries, repeated roles, and other native roles such as
`developer`. Keep recorded tool-call names/arguments and tool-result associations visible within
the relevant messages. This exposes the prompt's composition before drilling into long bodies.

Show the current call's **response** separately, including any requested tool calls. Assistant
messages in the prompt belong to the input history; the response is the output of this call.

### ToolCall: name, arguments, and output

Show the **tool name**, actual **arguments**, and observed **tool output**, including any execution
error. Link the model's request to invoke the tool to the resulting execution. Follow the result
into subsequent model prompts to see how it was presented back to the model; a runtime may project
or truncate the raw output before including it.

### Operations and evidence

Show initialization, compact, checkpoint/recovery, and finalization at their actual positions.
For compact or recovery, retain links to the state before and after the operation so the reader
can inspect what information survived and what the agent did next.

Link turns, calls, and operations to native event IDs or source nodes/spans. Preserve retries,
mark missing or truncated details, and treat unobserved child execution as opaque. Use recorded
semantics to establish inputs, turn boundaries, and outcomes; timing alone cannot establish them.

### Implementation reference

The [trace-harness AgentRun IR](https://github.com/compforge/quality-harness/blob/main/spec/trace-harness.md#4-agentrun-ir)
maps this view to `AgentRun`, `AgentTurn`, `ModelCall`, `ToolCall`, and `Operation`, with nested runs
and `source_node_ids` for provenance. The project/framework extractor owns boundaries, call
correlation, operation names, and event reconstruction; the harness validates and renders the
projection. Reuse the project's available reader or extractor and its native artifact contracts.

## Inspect an execution

1. Locate the business execution and its relevant loops. Identify each loop's role/objective,
   framework, session/run IDs, parent or caller, terminal state, and evidence location. Use the
   current conversation's target when clear; clarify when several runs remain plausible.
2. Open the selected loop through the project's existing session reader, report, or extractor.
   Present the objective, available instructions/context, and the loop view described above.
3. Explain significant or suspicious steps through their new evidence, decisions, and contribution
   to the objective. Reconcile the loop's completion, failure, cancellation, or unknown state with
   the business execution's result and delivery state.

For “show the view” requests, lead with execution identity, the view, key observations, and an
existing report/artifact link when available. A textual reconstruction from sufficient native
records is useful when no visual renderer exists; label it as reconstructed and retain source
references. Propose a quality improvement when the observations support one.

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
  and token analysis, read [context-management.md](context-management.md).

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

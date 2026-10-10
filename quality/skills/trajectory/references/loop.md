# Agent loop and turn analysis

Use this reference to explain how turns explore and advance a task, and how context, tools,
termination, or orchestration help or hinder that progress.

## Loop and turn

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

The mechanism surface includes budget allocation, planning, retries, checkpoints, concurrency,
cancellation, caching, state retention, convergence, partial results, termination, model routing,
and orchestration across agent-loop segments.

## Signals

- Work is useful but repeatedly times out or fails to produce a final deliverable.
- Model, tool, or runtime failures are retried without being retained as observable step outcomes.
- Retry or navigation cycles continue after evidence has converged.
- Independent actions are serialized because the runtime offers no bounded parallel path.
- Failures discard completed work that could have been checkpointed or delivered incrementally.
- The same facts or decisions are reconstructed across phases or agents despite stable identity.
- Outcomes correlate with budget exhaustion, scheduling, cancellation, or recovery rather than one
  prompt or tool call.
- Work partitioning causes duplicated discovery, missing handoff context, blocked waits, or lost
  evidence during aggregation.

Mechanism changes should state the invariant they enforce and the trace change they predict: fewer
retries, earlier partial delivery, concurrent independent calls, retained decisions, or bounded
termination. Keep orchestration fixes at the orchestration owner instead of hiding them in a leaf
prompt or tool.

## Trace work across loop boundaries

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

## Compact signals

Treat compact as a distinct mechanism and compare steps immediately before and after it. Investigate
compact, its trigger, or its retained-state contract when:

- files, search results, tool outputs, or repository facts are fetched again soon afterward;
- accepted constraints, decisions, completed work, or unresolved items disappear or change;
- tool selection, argument quality, or effect degrades only after compact;
- the agent repeats an already completed reasoning path or loses evidence provenance;
- compact occurs just before delivery and consumes the remaining budget needed to finish;
- prompt tokens fall locally, but total tokens, calls, or duration rise while state is rebuilt;
- the summary retains narrative history but omits stable identifiers, decisions, evidence receipts,
  current state, or next work.

Do not infer a compact problem from the event alone. Check what information was retained, compare
otherwise similar trajectories, and distinguish unnecessary reconstruction from a required refresh
of external state.

## Candidate changes

- Allocate explicit exploration, execution, verification, and delivery budgets.
- Bound retries and navigation cycles with evidence-based convergence rules.
- Checkpoint stable decisions, evidence identities, completed work, and unresolved items.
- Preserve valid partial results and support incremental delivery or anytime completion.
- Run independent work concurrently within declared capacity, timeout, and cancellation limits.
- Improve cache and shared-state identity across phases or agent-loop segments.
- Adjust compact trigger, reserved budget, summary schema, stable references, and resume instructions.
- Change task partitioning, routing, handoff, aggregation, or cross-loop deduplication.
- Treat model family or reasoning effort as a controlled runtime experiment after checking prompt,
  tool, context, and mechanism explanations.

## Validate

Record loop configuration, compact policy, model routing, and orchestration identity. Generate from
the same Case/input workload, align trajectory cohorts by stable identity, predict the structural
trace difference, and compare completion, retries, duplicated work, post-compact rework, total and
normalized tokens, duration, tail latency, and effect. A compact improvement must reduce
complete-trajectory cost or improve completion/effect; shrinking one prompt is insufficient.

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

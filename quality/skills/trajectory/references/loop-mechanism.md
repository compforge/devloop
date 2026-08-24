# Loop-mechanism optimization

Use this reference when good or locally reasonable decisions still produce waste, lost work,
timeouts, incomplete delivery, or repeated state reconstruction because of runtime behavior.

The mechanism surface includes budget allocation, planning, retries, checkpoints, concurrency,
cancellation, caching, state retention, convergence, partial results, termination, model routing,
and orchestration across agent-loop segments.

## Signals

- Work is useful but repeatedly times out or fails to produce a final deliverable.
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

Record loop configuration, compact policy, model routing, and orchestration identity. Predict the
structural trace difference and compare completion, retries, duplicated work, post-compact rework,
total and normalized tokens, duration, tail latency, and effect. A compact improvement must reduce
complete-trajectory cost or improve completion/effect; shrinking one prompt is insufficient.

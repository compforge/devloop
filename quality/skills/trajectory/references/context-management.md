# Context management and token cost

Use this reference when recorded prompts grow across turns or context policy may contribute to
cost, slow model calls, or lost evidence. Inspect the installed generator and its pinned harness
version before proposing a policy; a different checkout may already behave differently.

## Measure what the model receives

Follow the same result through raw tool output, projected request, later retained requests, and
provider usage. A large transcript result may become a short reference before the model sees it.
Conversely, a modest result retained for many turns can dominate cumulative input. Join by stable
execution, turn, request, and tool-call identities: asynchronous recording can place a compaction
event after the request that already contains its projection.

Separate reported input, output, cache usage, and missing usage. Prompt character counts help locate
content but are not billed tokens. Keep failed and unfinished requests visible; their absent usage
does not mean zero cost. Compare per-turn growth within the same executions, since later-turn
cohorts contain only the longer-running work.

Break visible context into initial instructions and task facts, source ranges, search/diff results,
prior decisions, and current evidence. Measure how often each is resent. Repeated context is not
necessarily a repeated tool call; assess those costs separately. Preserve snapshot and range
identity when deciding whether two reads contain the same evidence.

## Inspect retention before changing thresholds

Check the native compaction chain, trigger, target size, ordering, priorities, and commit semantics.
A provider capacity limit and a useful working-context budget answer different questions. A policy
that trims only enough to cross back below its trigger can leave long executions near that limit
and repeatedly compact small amounts.

Trace newly acquired evidence into the first request that could use it. A compactor that reduces
the newest equal-priority messages to preserve the longest cached prefix can retain old context
while replacing fresh source with a reference. Count this pattern, inspect what older evidence
remains, and include counterexamples where new evidence is retained or a huge result is sensibly
bounded. Absence of reported cache hits leaves the cache benefit unmeasured.

Candidate changes depend on that evidence:

- Bound tool output at admission, including long individual lines and generated or embedded source.
  Keep exact hits, useful surrounding ranges, and provenance available for selective expansion.
- Give recent results a bounded opportunity to inform the next decision; demote stale exploration
  before discarding evidence for the active question. Preserve tool-call/result pairing.
- Use task relevance, snapshot/range identity, and completed versus unresolved work to choose what
  persists. Inspect existing typed projections and summary checkpoints before adding another layer.
- When protecting active context outside a compaction chain, apply that protection to every stage.
  Account for protected tokens before passing a ratio to history compactors; inspect their own recent
  suffix defaults to avoid reserving the same content twice. Importance and current-round protection
  are separate decisions. Completed task anchors must be able to age into history.
- Consider a lower working-context target with room below the trigger. Measure re-reads and missing
  evidence when evaluating it; a smaller request alone does not establish improvement.

## Separate context cost from timeout causes

Break time into queueing, connection/request write, waiting for a response, response transfer,
retry attempts, and enclosing deadlines. For non-streaming calls, response wait includes generation;
it is not a direct measure of network latency or time to first token.

Compare both input and output tokens against call duration, sliced by model/endpoint, task, and
concurrency when available. Output volume can explain slow calls more strongly than input size.
Successful-call correlations exclude censored timeout attempts and do not establish causality.
Join launcher terminal records to unclosed trajectories before attributing missing ends to a crash
or model timeout; shortening prompts does not itself reconcile an outer process deadline.

## Validate one policy at a time

Replay a deterministic projection change against captured inputs with stable snapshot identity.
Check which fresh evidence survives, retained bytes or estimated tokens, pairing, and correctness
of references. Then generate aligned Case/input trajectories to measure cumulative reported tokens,
turns, repeated reads after compaction, call latency, timeout/completion, and effect. Include output
and summary-call cost. Keep current-run examples and numbers in project evaluation assets; promote
only reusable diagnosis and validated tactics into the skill.

# Tool optimization

Use this reference when a trajectory smell suggests friction in the capabilities exposed to the
agent or in a tool contract.

The tool surface includes which tools are available, overlap among them, tool names and
descriptions, argument schemas, operation granularity, batching and concurrency, errors, latency,
and result shape, size, identity, and provenance.

## Signals

- Several calls repeatedly express one intent already known before the first call.
- Tool A is predictably followed by tool B using only information returned by A.
- The agent alternates between overlapping tools or consistently chooses the wrong one.
- The model repeatedly produces arguments rejected by schema validation or the tool runtime.
- Calls succeed only after argument repair, reformatting, or discovering an undocumented constraint;
  a successful retry must not hide the preceding error smell.
- A result is much larger than the evidence used by the next decision.
- A result omits bounded context that is almost always fetched immediately afterward.
- Serial tool latency dominates duration while model decisions between calls are short.
- Missing stable identity or provenance causes repeated lookup, duplicate work, or weak attribution.

Describe these as abstract behavior motifs before naming a project API. A recurring discovery-then-
fetch transition, for example, is evidence of a contract opportunity; it does not prescribe a
particular option name or require the two operations to be merged.

## Disconfirm before editing

- Inspect counterexamples where the separate calls preserve a meaningful intermediate choice.
- Check permissions, freshness, pagination, rate limits, output bounds, and per-item error semantics.
- Verify that the model knew all call targets early enough for batching or parallelism.
- Distinguish a weak tool contract from an instruction that told the agent to use it incorrectly.
- Distinguish unclear name, description, schema, examples, defaults, and errors from a model that
  fails despite an unambiguous contract.
- Measure complete-trajectory cost: a richer result may use more local tokens but remove later calls.

## Candidate changes

- Add, remove, or consolidate exposed capabilities when tool overlap confuses selection.
- Clarify tool name, description, applicability, argument names, types, constraints, and examples.
- Return actionable validation errors that let the model repair one argument without rediscovery.
- Add set-oriented or batch operations when one intent fans out into repeated calls.
- Support bounded parallel execution when calls are independent and capacity is explicit.
- Filter, paginate, summarize, or return identifiers plus selective detail when output is overbroad.
- Return optional bounded next-step context or expose a composed operation for a stable transition.
- Preserve stable identifiers and provenance so later steps can reuse and attribute evidence.

## Validate

Record the exposed tool list and changed contract version. Generate from the same Case/input
workload, align trajectory cohorts by stable identity, and predict the trace difference: fewer calls,
fewer argument repairs, different tool selection, less unused output, or lower tool latency. Compare
effect, completion, errors, total and normalized tokens, duration, and tail latency. Inspect cases
that depended on the previous granularity or result boundary.

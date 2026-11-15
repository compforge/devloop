# Job, Session and Prompt views

Use this reference to identify an evaluation subject, inspect its execution or connect task results
to agent behavior. The shared data contract is Agent Ledger's
[Observation](https://github.com/compforge/agent-ledger/blob/main/docs/observation.md).
Job View, Session View and Prompt View primarily serve presentation and human supervision.
They are peer entry points for understanding business progress, execution and context. SessionView and
JobView are structured observation snapshots; Prompt View organizes a prompt for reading using
recorded requests or explicitly labeled source reconstruction. Text and HTML are reading surfaces.
“Loop view” and “agent view” requests select SessionView presentation.

Views expose facts for people; evaluators consume canonical evidence to produce separate results.
Evidence references let people inspect the execution behind a score and report problems outside
current evaluator coverage. Neither branch depends on running the other. Human interpretation is
an observation or diagnosis until recorded under an explicit evaluation criterion.

## Facts and view projections

Keep the recorded subject, standardized facts, view model and rendering surface distinct:

```text
actual model request messages --------------------------> Prompt View
loop execution -> ATIF Trajectory -----------------------> SessionView -> text/TUI/Web
                       └-> evaluators -> separate scores
business work across loops and deterministic operations -> JobView
```

ATIF defines a trajectory interchange format. It does not define SessionView or the project's
rubric. A project adopting ATIF stores canonical execution facts in Trajectory and evaluates those
facts; it may choose one actual loop execution per document. For example, CCR can standardize R1
and R2 loop recordings as ATIF before scoring them. This is an evaluation-grain decision, not a rule
that every ATIF document or every Session must contain exactly one loop.

SessionView organizes observations for one Agent Session. Several trajectory documents may share
that Session and contribute to its view. `trajectory_id` identifies a document; `session_id`
identifies its declared run/session context under the source contract. Preserve source-defined
inheritance for embedded trajectories, but do not infer Session ownership from business IDs.
SessionView can also come directly from Trace or native recordings. Do not require ATIF conversion
for an already usable view, or assume the view can reconstruct all source trajectory fields.

Prompt View organizes the actual request's message list in order, by role and internal sections.
Tool definitions and other request inputs can live outside messages. An output transcript is not
proof of the exact prompt; label reconstruction or missing requests explicitly.

Evaluate the project's canonical evidence, keep criterion versions and score/evidence references
in separate results, and use these views to inspect the decisions behind a score. View rendering
must not silently recollect evidence, rerun evaluation or rewrite recorded facts.

## Three analysis views

| Perspective | Subject | Questions |
|---|---|---|
| [SessionView](session-view.md) (`agent-ledger/session@1`) | One Agent Session accepting inputs and making calls | What context did the agent receive? What changed after followup, steer, compact or resume? Where did it repeat work or lose progress? |
| [JobView](job-view.md) (`agent-ledger/job@1`) | One business goal and the work contributing to it | Was the goal achieved? Where did work wait, repeat or get lost? Were handoffs and delivery effective? |
| [Prompt View](prompt-view.md) | The prompt for a selected model call, or a comparison of prompts | How are instructions, task facts, history, evidence and tools organized? How does each part change as turns advance? What is missing, conflicting, stale or repeated? |

One Session can contribute to several Jobs; one Job can involve several Sessions and deterministic
operations. Task-oriented and continuous describe how an Agent serves Jobs, not different loop
algorithms. A task-oriented Session and Job may contain nearly the same calls while retaining
distinct identities. Ending an invocation, closing a Session and completing a Job are independent.
A Session snapshot has no inferred root completion verdict.

Start from the question. Inspect Job goals and results, Session decisions and actions, or Prompt
organization. Move from a result to its calls and exact requests, or from a prompt concern
to the response, subsequent actions and linked Job consequences. Preserve call identity and source
positions across these views. None is restricted to one of Good, Fast, Cheap, and a bounded analysis
need not render all three.

## Nodes and evidence

SessionView and JobView use the same Node types; Prompt View selects ModelCall request content:

- `Input`: input observed by the agent, with delivery mode when recorded.
- `ModelCall`: an observed model invocation with its recorded request and response.
- `ToolCall`: an observed tool execution, including middleware decisions when that is the source's
  execution boundary. Preserve disposition; a proposed tool is not proof its function executed.
- `Operation`: other work such as routing, compaction, waiting, recovery or delivery; it can group nodes.
- `Turn`: an optional, source-recorded interaction boundary.

Display model requests as ordered native messages, preserving roles, boundaries, tool definitions
and content. Display the current response separately from assistant messages already in the request.
A transcript is not an exact request: missing request content remains unknown. Show actual tool
arguments, observed output and errors, then follow the result into later requests when recorded.
Raw output and the projection visible to the model can differ.

Keep native timing, usage, retries and source evidence. Missing values differ from zero; unanswered
calls remain unresolved observations. Array order or overlapping time does not establish dependency.
Grouping organizes work without inventing a parent timing envelope or a required Turn structure.

## Identity and cross-view links

Session identity is `(source, session id)`; Job identity is `(source, job id)`. In a Job, a
Session-owned Node retains `(source, session id, node id)`. A Job-local Node belongs to that Job's
namespace. Preserve native IDs and explicit ownership when selecting Session fragments.

The project determines Job membership from business records. Shared selection helpers preserve
observations; they do not decide business membership. A ToolCall's related Session references identify
other Sessions, not automatically the fragment belonging to a Job. Explicit handoff/dependency
relations carry their recorded evidence; temporal proximity is insufficient.

Use scoped Node references to connect findings and judgments back to the selected snapshot and
original records. An evaluation can consult surrounding Session context without expanding the Job's
membership or charged cost. Record that context as supporting evidence. Missing linked fragments or
opaque child executions are coverage gaps, not fabricated failures.

## Ownership

Source adapters map native Session or trace evidence to observations. The business project supplies
Job goals, membership, relations and completion. Agent Ledger owns the shared models, validation,
selection and rendering; using Observation does not require a Ledger Store or recovery setup.
Trace Harness connects physical trace evidence to observations and supports infrastructure diagnosis.
Trajectory Harness owns measurements, evaluation execution, aggregation and reports. The trajectory
skill selects the question, operates project entrypoints and explains the evidence. Business criteria,
private recordings and operational commands remain with the project.

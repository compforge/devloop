# Session and Job observations

Use this reference to identify an evaluation subject, inspect its execution or connect task results
to agent behavior. The shared data contract is Agent Ledger's
[Observation](https://github.com/compforge/agent-ledger/blob/main/docs/observation.md).
A View is a structured observation snapshot. Text and HTML render the same recorded facts for
different reading surfaces. “Loop view” and “agent view” requests select SessionView presentation.

## Two perspectives on execution

| Perspective | Subject | Questions |
|---|---|---|
| SessionView (`agent-ledger/session@1`) | One Agent Session accepting inputs and making calls | What context did the agent receive? What changed after followup, steer, compact or resume? Where did it repeat work or lose progress? |
| JobView (`agent-ledger/job@1`) | One business goal and the work contributing to it | Was the goal achieved? Where did work wait, repeat or get lost? Were handoffs and delivery effective? |

One Session can contribute to several Jobs; one Job can involve several Sessions and deterministic
operations. Task-oriented and continuous describe how an Agent serves Jobs, not different loop
algorithms. A task-oriented Session and Job may contain nearly the same calls while retaining
distinct identities. Ending an invocation, closing a Session and completing a Job are independent.
A Session snapshot has no inferred root completion verdict.

Start from the question. Inspect Job goals and results for a task question, then open relevant
Session context to explain decisions. Inspect a Session for a continuity or context question, then
use explicit Job links to judge contribution. Neither perspective is restricted to cost or effect.

## Nodes and evidence

Both views use the same Node types:

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

## Inspecting a view

Show the subject identity and snapshot scope, goal or active inputs, significant nodes, known
outcomes and evidence issues. In conversation/TUI, present SessionView as text using the convention
below. Use a project renderer for a requested HTML page or artifact and link its output when available.
When reading native records directly, identify the source and preserve unknown boundaries.
Rendering does not resume agents or replay tools.

For a Job, distinguish the source's execution outcome from evaluation of correctness and value.
For a Session, show the outcomes of observed work without treating an open Session as unfinished
business. Rendering or structural validation cannot establish task success.

## SessionView text rendering

Text rendering makes the recorded context and call sequence visible in the conversation. It is a
presentation of SessionView, independent of diagnostic judgments. A skill can produce it directly
from available evidence; do not assume a particular renderer function or CLI exists.

Lead with Session identity and the selected snapshot or Node range. Show observed Inputs, then
ModelCalls, associated ToolCalls and relevant Operations in recorded order, preserving concurrent
or otherwise unordered relationships. Include native Turn grouping only when present. For each
ModelCall, show the actual Request message structure and the current Response separately.

Illustrative layout; IDs, roles and content below are placeholders, not required source structure:

```text
Session <source/id> · snapshot <identity> · scope <range>
  Input <id>: <recorded content>
  ModelCall <id>
    Request
      tools: <recorded definitions, in their actual request location>
      messages
        [0] system: <recorded content>
        [1] user
            part[0]: <recorded content>
            part[1]: <recorded content>
    Response: <recorded answer / requested tool calls>
  ToolCall <id> · model_call <id>
    arguments: <actual arguments>
    result: <observed output / error / disposition>
  Operation <id>: <compact or other recorded work>
  ModelCall <id>
    Request: <ordered structure, with explicit display omissions>
    Response: <recorded output>
```

Preserve message roles, order, boundaries and native content parts, including repeated roles and
non-text parts. Keep tool definitions at their recorded location. An explanatory label such as
“candidate topics” is an analyst annotation, not a replacement role or a reason to regroup messages.
For long content, distinguish exact excerpts from summaries and mark omissions. Keep Node IDs,
message/part positions and source references so a follow-up request can expand the relevant content.
Timing and usage can accompany calls when recorded; they do not replace their content.

Compare adjacent recorded ModelCall requests when useful: show additions, removals, replacements
and unchanged material omitted only from display. Name the compared calls and distinguish observed
changes from inferred semantic correspondence. A presentation diff does not mean the model received
only a delta. Missing exact requests stay unknown; transcript history cannot supply an invented one.
Keep diagnosis separate from the rendered facts and use [Context](context.md) to interpret changes.

## Following a task across Sessions

In a review system, Unit `u1` can pass from a discovery Session to a shared reviewer Session and
then a deterministic Trial. Its JobView selects the explicitly associated calls and Trial outcome.
If the reviewer rejects a hypothesis, inspect that call's actual request and preceding Session
context to determine what evidence was available. Other Units in the reviewer Session are context,
not automatically members of `u1`.

If one model call serves both `u1` and `u2`, both JobViews retain that call's same Session-scoped
identity. Their combined cost counts it once; each Job's exclusive share remains unknown without
an allocation policy. The shared call's full prompt stays intact in both observations.

A personal assistant's input Job can end in an acknowledged action, a delivered message or deliberate
silence. Follow routing, assessments and delivery receipts to establish which result actually
occurred, then apply the input's business criterion. An open assistant Session and an absent message
alone establish neither failure nor success.

## Ownership

Source adapters map native Session or trace evidence to observations. The business project supplies
Job goals, membership, relations and completion. Agent Ledger owns the shared models, validation,
selection and rendering; using Observation does not require a Ledger Store or recovery setup.
Trace Harness connects physical trace evidence to observations and supports infrastructure diagnosis.
Trajectory Harness owns measurements, evaluation execution, aggregation and reports. The trajectory
skill selects the question, operates project entrypoints and explains the evidence. Business criteria,
private recordings and operational commands remain with the project.

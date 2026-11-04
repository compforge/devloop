# Job, Session and Context views

Use this reference to identify an evaluation subject, inspect its execution or connect task results
to agent behavior. The shared data contract is Agent Ledger's
[Observation](https://github.com/compforge/agent-ledger/blob/main/docs/observation.md).
Job View, Session View and Context View primarily serve presentation and human supervision.
They are peer entry points for understanding business progress, execution and context. SessionView and
JobView are structured observation snapshots; Context View organizes a prompt for reading using
recorded requests or explicitly labeled source reconstruction. Text and HTML are reading surfaces.
“Loop view” and “agent view” requests select SessionView presentation.

Views expose facts for people; evaluators consume canonical evidence to produce separate results.
Evidence references let people inspect the execution behind a score and report problems outside
current evaluator coverage. Neither branch depends on running the other. Human interpretation is
an observation or diagnosis until recorded under an explicit evaluation criterion.

## Facts and view projections

Keep the recorded subject, standardized facts, view model and rendering surface distinct:

```text
actual model request messages --------------------------> Context View
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

Context View organizes the actual request's message list in order, by role and internal sections.
Tool definitions and other request inputs can live outside messages. An output transcript is not
proof of the exact prompt; label reconstruction or missing requests explicitly.

JobView organizes the recorded progress and outcome of one business goal. Its work may span
multiple loops/Sessions, or select a subset of calls from a shared loop. One loop may contribute
to several Jobs. Follow explicit business/call references instead of copying whole Sessions into
each Job, double-counting shared work, or interpreting business stages as agent delegation.

Evaluate the project's canonical evidence, keep criterion versions and score/evidence references
in separate results, and use these views to inspect the decisions behind a score. View rendering
must not silently recollect evidence, rerun evaluation or rewrite recorded facts.

## Three analysis views

| Perspective | Subject | Questions |
|---|---|---|
| SessionView (`agent-ledger/session@1`) | One Agent Session accepting inputs and making calls | What context did the agent receive? What changed after followup, steer, compact or resume? Where did it repeat work or lose progress? |
| JobView (`agent-ledger/job@1`) | One business goal and the work contributing to it | Was the goal achieved? Where did work wait, repeat or get lost? Were handoffs and delivery effective? |
| Context View | The prompt for a selected model call, or a comparison of prompts | How are instructions, task facts, history, evidence and tools organized? What is missing, conflicting, stale or repeated? |

One Session can contribute to several Jobs; one Job can involve several Sessions and deterministic
operations. Task-oriented and continuous describe how an Agent serves Jobs, not different loop
algorithms. A task-oriented Session and Job may contain nearly the same calls while retaining
distinct identities. Ending an invocation, closing a Session and completing a Job are independent.
A Session snapshot has no inferred root completion verdict.

Start from the question. Inspect Job goals and results, Session decisions and actions, or Context
prompt organization. Move from a result to its calls and exact requests, or from a prompt concern
to the response, subsequent actions and linked Job consequences. Preserve call identity and source
positions across these views. None is restricted to one of Good, Fast, Cheap, and a bounded analysis
need not render all three.

## Context View

A **Context View** is a text outline of an agent's context/prompt (a prompt outline): message
roles form the outer structure, and sections within complex messages form the inner structure.
It is a first-class reading and analysis view for prompt organization, alongside Session execution
and Job outcomes. It reuses request evidence without requiring a separate Agent Ledger schema.

Lead with the message roles in their actual order, such as `system`, `user`, `assistant` and
`tool`. Within a complex message, show how many meaningful sections it contains and briefly
explain each one; a simple message needs only a short description. These sections describe prompt
composition and need not correspond to native API content parts. Preserve repeated messages of the
same role rather than merging them into one role bucket. Semantic labels such as background or
candidate topics belong under the containing message, not in place of its role.

Illustrative prompt outline; roles, counts and sections must follow the available evidence:

```text
system — 3 sections
  1. Assistant identity and boundaries
  2. Task-specific instructions
  3. Output requirements
user — 2 sections
  1. Current background
  2. This round's request and candidate data
```

Use brief descriptions and selected excerpts. Add source, refresh behavior or truncation details
where they help inspect the prompt. Show tool definitions at their actual request location, which
may be outside messages, and separate information available through tool reads from content already
in the prompt. Mark unknown role placement in source reconstruction instead of inventing it.

Use this overview to make potential problems visible: conflicting or duplicated instructions,
missing decision context, stale history, irrelevant material, unclear instruction/data boundaries,
and truncation that hides important facts. Follow the overview with brief, evidence-backed concerns
when present; distinguish a possible prompt issue from a demonstrated cause of agent behavior.
Expand exact messages or source details when needed to investigate a concern.

A Context View may use recorded requests or source reconstruction. State which evidence it uses
and the relevant call or code revision. Label summaries, omissions and illustrative values; leave
runtime-only content unknown when reconstructing from source. An overview is not a verbatim request
capture; exact recorded requests remain available through SessionView when the evidence exists.

## Nodes and evidence

SessionView and JobView use the same Node types; Context View selects ModelCall request content:

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

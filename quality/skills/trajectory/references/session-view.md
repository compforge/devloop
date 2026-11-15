# Session View

[Shared view contracts](observation.md)

## Inspecting a view

Show the subject identity and snapshot scope, goal or active inputs, significant nodes, known
outcomes and evidence issues. In conversation/TUI, present SessionView as text using the convention
below. Use a project renderer for a requested HTML page or artifact and link its output when available.
When reading native records directly, identify the source and preserve unknown boundaries.
Rendering does not resume agents or replay tools.

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


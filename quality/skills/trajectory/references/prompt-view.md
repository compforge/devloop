# Prompt View

[Shared view contracts](observation.md)

A **Prompt View** is a text outline of an agent's context/prompt (a prompt outline): message
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

Use brief descriptions and selected excerpts. For each meaningful part, show its purpose, source
and size or truncation when available. When comparing turns, inspect how that part changes across
the selected ModelCall requests:

- Record whether it stays unchanged, is added or removed, grows by appending, or is replaced,
  reordered or compacted. Match parts using recorded identities and structure; label inferred matches.
- Distinguish a refreshed current-state snapshot from appended conversation history. For example,
  a Note directory may change its membership or names in the next request while existing user,
  assistant and tool messages retain their recorded content. Compare directory entries by stable
  Note ID so a rename remains an update to the same entry.
- Locate the first request containing a change and relate it to recorded input, tool or refresh
  events. Source code can explain an expected refresh policy; request snapshots establish what
  actually changed. A single snapshot leaves cross-turn change unknown.
- Show where changed parts occur in the request prefix and how they may reduce prefix-cache reuse.
  Evaluate the trade-off between fresh, relevant context and cache efficiency using task outcomes,
  input size, recorded cache usage and latency. Refreshing a part can justify reduced cache reuse;
  preserving prefix-cache hits is an optimization objective, not a correctness requirement. Request
  differences alone do not establish cache misses or a performance regression.

Include the compared call IDs and turn boundaries where recorded. Show tool definitions at their
actual request location, which may be outside messages, and separate information available through tool reads from content already
in the prompt. Mark unknown role placement in source reconstruction instead of inventing it.

Use this overview to make potential problems visible: conflicting or duplicated instructions,
missing decision context, stale history, irrelevant material, unclear instruction/data boundaries,
and truncation that hides important facts. Follow the overview with brief, evidence-backed concerns
when present; distinguish a possible prompt issue from a demonstrated cause of agent behavior.
Expand exact messages or source details when needed to investigate a concern.

A Prompt View may use recorded requests or source reconstruction. State which evidence it uses
and the relevant call or code revision. Label summaries, omissions and illustrative values; leave
runtime-only content unknown when reconstructing from source. An overview is not a verbatim request
capture; exact recorded requests remain available through SessionView when the evidence exists.


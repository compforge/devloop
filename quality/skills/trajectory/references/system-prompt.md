# System-prompt optimization

Use this reference when a trajectory smell suggests that the agent has sufficient capabilities and
observations but repeatedly applies the wrong objective, policy, or decision rule.

The instruction surface includes system and developer prompts, project instructions, loaded
skills, the user request, and their ordering and precedence. Change the closest owner of the
knowledge: project facts belong near the project, reusable operating knowledge belongs in a skill,
and runtime invariants belong in the mechanism that enforces them.

## Signals

- The same misunderstanding appears across different tools, stages, or workload cohorts.
- The agent uses available evidence but applies the wrong quality bar, severity boundary, priority,
  attribution rule, or output contract.
- It consistently stops too early, continues after completion, or leaves too little time to deliver
  because the stated completion rule is unclear.
- Instructions conflict, duplicate each other, arrive after the decision they should guide, or
  consume context without changing behavior.
- Failures correlate with missing domain knowledge or operating guidance rather than a missing
  capability.
- A rule is followed only when it happens to be restated in recent context.

## Disconfirm before editing

- Verify that the required evidence was actually available to the model at the decision step.
- Check whether a tool description or schema, not the prompt, caused the wrong selection or action.
- Check whether compact or handoff removed an instruction that was originally present.
- Check whether the requested behavior should be enforced deterministically by a tool or loop
  mechanism instead of repeatedly requested in prose.
- Compare successful counterexamples to see whether instruction presence, ordering, or wording
  actually differs.

## Candidate changes

- Clarify the objective, quality bar, evidence standard, priority, or stop condition.
- Remove conflicting and duplicated instructions; place stable guidance once at the correct level.
- Move project-only knowledge out of a global prompt and into project instructions.
- Turn reusable multi-step judgment into a skill instead of growing the system prompt indefinitely.
- Require explicit evidence receipts or a decision record when the failure is weak attribution.
- Replace a soft prompt rule with a deterministic gate when violations must never be accepted.

## Validate

Predict which decisions should change, not only how many prompt tokens should fall. Reuse the same
Case/input workload and evaluation semantics, record the full instruction identity and ordering,
and align the newly generated trajectory cohorts by stable Case or input identity. Compare the
target decision pattern, effect, completion, total tokens, and duration. Inspect counterexamples for
new over-constraint or premature stopping.

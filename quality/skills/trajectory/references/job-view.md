# Job View

[Shared view contracts](observation.md)

JobView organizes the recorded progress and outcome of one business goal. Its work may span
multiple loops/Sessions, or select a subset of calls from a shared loop. One loop may contribute
to several Jobs. Follow explicit business/call references instead of copying whole Sessions into
each Job, double-counting shared work, or interpreting business stages as agent delegation.

## Inspecting a Job

For a Job, distinguish the source's execution outcome from evaluation of correctness and value.

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


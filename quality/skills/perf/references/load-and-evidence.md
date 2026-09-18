# Performance load and evidence

Use this reference when selecting load, interpreting a run, or comparing experiments. Shared
identity and evidence semantics are defined in [Quality concepts](../../../CONCEPTS.md).

## Establish the native load contract

Inspect the project's wrapper, installed framework version, profile, and persisted schema together.
Use its native scheduler and result rules. The quality-harness LoadPlan contract below provides
concrete interpretation when that SDK is in use; other frameworks can have different admission,
drop, queue, and phase behavior. Preserve those differences in the report.

Load has two independent axes:

- `request_rate`: the configured request initiation rate;
- `max_inflight`: the maximum simultaneous requests across their full lifecycle, including reading
  a complete SSE response.

For quality-harness, finite rate controls initiation while slots are available; a full inflight
limit pauses the source. There is no pending queue, fabricated arrival/drop, or catch-up burst.
`inf` replenishes available slots. Lowering the cap pauses new calls without canceling existing
ones. An inflight-limited run can show zero drops and acceptable latency while sending less than
the configured rate. Check `limited_s`, dispatch rate, and completion throughput together.

For a framework with open-loop admission, account for offered arrivals and drops; for feedback
load, explain how slow responses reduce offered traffic. Never compare latency percentiles while
hiding a change in the admission model or coordinated-omission caveats.

## Follow phases and realized windows

Quality-harness uses `setup → warmup → hold → cooldown → cleanup`:

- Warmup steps toward the configured rate until it reaches that rate or the inflight cap.
- Hold starts when actually entered and uses the configured target rate as its replenishment
  pace, even if warmup reached the cap at a lower rate. Its duration is `hold_s`.
- Cooldown stops initiation and waits up to `cooldown_timeout_s`, then cancels and joins remaining
  calls before releasing clients. Optional `cooldown_s` extends resource observation after
  deactivation; it is separate from the wait for inflight requests.
- Explicit stages own their duration, rate, inflight limit, and warmup/hold/ramp kind. Default
  warmup and hold durations are not added to an explicit schedule.

Stages are plans; Windows record actual boundaries. Read `end_reason`, `complete`, and `limited_s`
with the stop record. Measurement begins at the first actual hold; drain time or a later Judge
exception must not extend it. Requests and resource samples use the same realized boundaries,
while warmup, individual stages, aggregate measurement, and cooldown retain distinct meanings.

Respect project-specific phase behavior when another framework is used. Never flatten warmup,
measurement, and recovery into a single apparent steady-state result.

## Join execution and evaluation evidence

An Arm names a resource/load configuration. An ArmRun is one actual execution containing request
scheduling records, OperationRuns with raw Outcomes, and independent per-request evaluations.
Use execution and operation IDs for joins. Display labels or configuration hashes do not identify
repeated executions. Check for ambiguous or duplicate identities before aggregating runs.

With quality-harness, inspect:

| Artifact | Evidence |
|---|---|
| `run.json` | Native schema, execution identities, Arm configuration, realized Windows, phase errors, and stop state. |
| `requests.jsonl` | Scheduling records and actual OperationRuns with their unique raw Outcomes; a drop has no call. |
| `evaluations.json` | Request judgments keyed by ArmRun and OperationRun identity. |
| `timeseries.csv` | Resource observations, when supplied by the implementation. |
| `verdict.json` | The native run-level decision and evidence references. |

Verify the reader supports the artifact schema. Python provides resource observation, SLO
evaluation, and HTML reporting; the TypeScript perf SDK supplies request execution and evidence,
with resource observation and gates supplied by the consumer. Discover the consumer's actual
capabilities rather than assuming SDK parity or a generic EvaluationRun/Worksheet artifact.

Preserve completed Outcomes when a Judge raises. Treat absent judgments as incomplete evaluation,
not observed product errors. Interrupted calls have their own records and do not enter latency
distributions or get judged as completed responses. Keep stop-time inflight counts, interruption
census, phase errors, and cleanup results alongside valid completed evidence.

## Interpret rates, latency, and business success

For quality-harness's half-open Windows `[start_s, end_s)`:

- Arrivals count actual accepted initiation opportunities by scheduled time; dispatches count
  actual sends by dispatch time.
- Completion throughput and success throughput count finished calls by finish time.
- Latency and request error rate use completed requests from the dispatch cohort, including those
  that finish during cooldown. Their sample count differs from completions inside the Window.
- Inflight peak/end include requests carried in from earlier Windows.

Drops and interruptions are not latency samples. Missing judgments, few samples, and native
`incomplete`, `co_biased`, or `high_drop` caveats constrain the conclusion. Transport success alone
does not prove SSE business completion; inspect the project's Judge and completion signals.
`first_byte_ms` measures first byte, not automatically first token; token timing needs an explicit
protocol fact from the Runner.

## Confirm capacity and compare curves

Quality-harness confirms capacity only from complete hold Windows with requests, no drops,
interruptions or missing judgments, and applicable SLOs that all pass. A finite-rate Window with
`limited_s > 0` cannot confirm configured-rate capacity or support resource-curve extrapolation.
An otherwise healthy run without SLOs is `skipped`, not confirmed capacity. A later failure can leave earlier complete
hold evidence usable; retain the run's failure separately.

For finite-rate sweeps, scan request rate and fix the inflight schedule. For `inf` sweeps, scan the
inflight limit. Fix resources, case mix, target and generator conditions, arrival distribution,
seed, durations, warmup, cooldown limits, and breakers. Stage shape along the scanned axis must be
proportional; matching peaks alone do not make schedules comparable.

Separate different fixed conditions. In particular, fixed finite rate with varying inflight caps
does not form a rate-capacity curve. Require at least two distinct levels within a comparable group
for a response curve or slope, label the axis and units, and distinguish measured capacity from
extrapolation. Use the native shared comparison grouping when available.

The source contract is [Perf Harness](https://github.com/compforge/quality-harness/blob/main/spec/perf-contract.md).
Resolve API details and schema support from the version used by the project; this skill does not
authorize an SDK upgrade or a profile conversion.

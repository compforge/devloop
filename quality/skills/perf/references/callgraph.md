# Call graph evidence for performance analysis

Use this reference when a perf run includes an operation graph and downstream HTTP observations,
or when the user asks which dependency limits throughput. Read the installed SDK's artifact
schema; a graph view or a `callgraph.json` snapshot may be available depending on its version.

## Establish what the graph represents

A call graph snapshot combines declared Operation relationships with measurements from one Run,
Arm and Window. Service is auxiliary ownership information. It is not a trace of a particular
request. Keep the original declaration separate from the run-enriched snapshot.

- `calls` (displayed as `call`) means required on the declared normal execution path.
- `may_call` means conditional within that scope. A failed or cancelled request can stop before
  reaching even a required call.
- A fixed case usually has a stable path. Different cases can have different graphs; do not
  interpret the product-wide union of possible paths as one case's actual execution.
- Positive QPS on a conditional callee supports possible use during the window. Without caller
  attribution it does not prove an incoming edge ran; other callers may contribute traffic.

Inspect Run/case identities, graph source/version, target environment, resource/load configuration,
window boundaries/completeness, metric units, counter semantics and query provenance before using
snapshot values as a baseline. Missing values must stay missing; never replace N/A with zero.

## Match observations to operations

HTTP metrics normally identify an API by service scope, HTTP method and route template, e.g.
`GET /products/{product_id}`. Raw paths containing concrete IDs are not interchangeable with
route templates. Inspect the actual metric/label names and deployment filters; OTel conventions
do not guarantee that every exporter exposes the same Prometheus label names or route coverage.

Keep server and client measurements distinct. For each rate, determine whether its counter is
incremented when a request enters or completes. A long SSE may produce downstream traffic long
before the entry's completion counter changes. An HTTP 200 or an established stream is not the
business completion signal; use the project's Judge for that.

Compare metrics over compatible windows. Query evaluation step is not scrape interval. Short
windows may contain too few scrapes; rolling rate intervals may include pre-run traffic. Compute
p95 after combining histogram buckets across matching instances, not by averaging Pod p95 values.
Inspect bucket coverage for long requests. Percentiles from parent and child APIs cannot be added
or subtracted to derive exclusive work or critical-path duration.

## Call amplification and visit ratio

One entry invocation can call the same downstream operation multiple times. This creates request
amplification; fan-out describes the broader branching into downstream work. For the mean number
of visits to a particular operation per entry request, the performance-modeling term is
**visit ratio**:

```text
V_i = downstream calls attributable to the entry cohort / entry requests in that cohort
X_i ≈ V_i × X_entry
```

The throughput relationship is the **Forced Flow Law**. For example, a checkout request that
checks inventory for four items on average produces about 20 inventory calls/s at 5 checkout
requests/s under stable conditions. The ratio can be below one for conditional calls or cache
hits. Multiple item lookups, loops, retries and independent call sites can all increase it;
a large ratio alone does not prove a defect or identify which cause applies.

When only aggregate Prometheus rates are available, `QPS_downstream / QPS_entry` is an observed
rate ratio, not an exact per-request call count. Use it as an estimate only after checking:

- matching population and deployment scope, with background traffic or other callers accounted for;
- compatible entry/completion counters and sufficiently stable, aligned windows;
- warmup, in-flight accumulation and drain boundaries, especially with SSE;
- retry and caching behavior, and changes in case mix or graph paths.

Do not divide by zero or substitute configured target QPS for observed entry rate. Do not assign
one callee's aggregate ratio to a particular edge when several parents share it. Trace-correlated
counts over a complete request cohort provide stronger evidence of visits per request.

Reference: Denning and Buzen, [The Operational Analysis of Queueing Network Models](https://cs.uwaterloo.ca/~ijdavis/teaching/2016winter/cs446/p225-denning.pdf), visit ratios and Forced Flow Law.

## Analyze a throughput obstruction

1. Establish the load facts: target initiation rate, actual dispatch rate, completion throughput
   by code, inflight peak/end, inflight-limited time and realized windows. Check generator and
   transport capacity, including recorded effective connection budgets, before blaming a service.
2. Read the case graph with the same window's node metrics. Identify missing observations,
   traffic amplification, slower APIs and response-code changes. Preserve candidate explanations.
3. Compare an earlier or lower-load run only after fixing case, graph revision, counter semantics,
   windows, resources and generator conditions. Report changed paths or configuration explicitly.
4. Follow candidates to service resource/queue/restart evidence and request traces or logs. A
   parent's long duration may include waiting on a child; sequential and parallel work behave
   differently. The largest p95 node is not automatically the bottleneck.
5. State the confirmed facts, plausible mechanism and remaining gap. Use a bounded follow-up
   experiment to discriminate mechanisms only when target and load are authorized; interpreting
   a snapshot does not itself authorize another pressure run.

The snapshot is useful material for Skill/Agent analysis and baseline comparison. Preserve its
numeric values, missing/error states and provenance, not just a screenshot or rounded labels.
For quality-harness, regenerate views from saved Run facts; recollect missing Prometheus history
through the native collect-metrics entrypoint without sending load. Do not silently alter an old
baseline after recollection: retain the collection attempt and which snapshot was compared.

For SDK configuration and artifact details, consult the project's installed version and
[HTTP metrics and Call Graph](https://github.com/compforge/quality-harness/blob/main/sdks/python/perf_harness/docs/callgraph.md).

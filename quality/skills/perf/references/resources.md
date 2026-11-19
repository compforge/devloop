# Service resource evidence

Use the call graph to find an Operation whose rate, errors or duration changed. Then inspect the
resources of its owning Service over the same window. A Service can serve several Operations and
other callers, so its resource series describes their combined activity.

## Read CPU and memory under load

Compare the Operation's RED metrics and the Service's resource timeline as observed inflight
requests rise, hold steady or drain. In a load test, the generator's inflight count covers all
outstanding injected requests. For observation-only runs, use available traffic measurements and
record which population they cover.

| Signal | What to check |
| --- | --- |
| CPU usage, request and limit (cores) | A request describes scheduled capacity and a limit caps CPU time. If latency rises as usage approaches the limit, check per-container throttling over that interval. |
| Memory usage, request and limit | Identify the usage measurement, such as working set in MiB. If usage grows as requests accumulate, inspect recovery after drain. Check OOM events and restarts when investigating a memory limit. |
| Workload and replica coverage | Check which Workloads, Pods and containers contributed at each timestamp. Scaling can change a Service total, and one busy replica can be hidden in the aggregate. |

Keep missing samples and unset limits visible. A matched Workload count measures declaration
coverage. Pod or container counts answer how many replicas or containers contributed.

For example, if an Operation's p95 rises with inflight and one backing container shows increased
CPU throttling in the same window, CPU contention is a bottleneck candidate. Check a slow request's
trace for time spent locally and in downstream calls before attributing the delay.

For the Quality Harness query and report contract, see [external metrics and offline Callgraph](https://github.com/compforge/quality-harness/blob/main/sdks/typescript/perf-harness/docs/observations.md).

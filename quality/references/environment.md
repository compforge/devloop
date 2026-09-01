# Environment

An **Environment** is the complete observable state required to execute a quality capability
against the intended system. It may be local, dev, or another remote environment; it does not need
to be a dedicated test environment. E2E and performance runs share this contract even though they
prepare different domain-specific conditions.

```text
Environment = Target + Runner + Connection
            + Preconditions + Fixtures + Controls
            + Cleanup + Evidence
```

- **Target** identifies the system under test, revision, configuration, and environment. It may be a
  local process or a remote environment such as Kubernetes.
- **Runner** is where the quality command and its traffic generator execute.
- **Connection** is the application data-plane path from Runner to Target.
- **Preconditions** are target or dependency facts that must already hold.
- **Fixtures** are records, identities, files, or other state owned by the run.
- **Controls** are temporary changes such as fault injection, resource selection, or load.
- **Cleanup and Evidence** prove what was restored and what actually ran.

The project owns target names, startup and access mechanisms, credentials, fixtures, controls, and
cleanup. A quality skill discovers and operates that knowledge; it does not replace it with generic
environment assumptions.

## Confirm Target, Runner, and Connection

Resolve before execution:

- the exact subject identity and revision;
- whether the Target is local or remote, and whether it is dedicated or shared;
- where the Runner executes;
- the endpoint and protocol the capability will actually use;
- the project-owned path connecting Runner to Target;
- independent evidence for Target health and application-level connectivity.

Common shapes include:

- **Local Target:** start or discover it through the canonical project entrypoint, then probe the
  same host, port, and protocol used by the quality workload.
- **Remote Target:** use the project-owned ingress, VPN, tunnel, port-forward, or in-environment
  Runner. For Kubernetes, API or `kubectl` access proves control-plane reachability only; it does
  not prove that the Runner can exchange application traffic with a Service or Pod endpoint.

Resolve the endpoint from target state instead of guessing a hostname, namespace, address, or port.
For a normal Kubernetes Service whose ClusterIP the Runner can route to directly, prefer its
`ClusterIP:port` over Service DNS. This avoids local DNS search-domain and VPN DNS behavior without
bypassing the Service data plane. When TLS SNI, HTTP `Host`, service-mesh routing, or another
protocol concern requires the logical service name, preserve that authority through the
project-owned runner configuration while connecting to the IP. Use Service DNS when the ClusterIP
is not routable or DNS resolution is itself part of the intended connection path or behavior under
test.
Probe it from the actual Runner and, when relevant, independently confirm the deployed revision and
health from the Target side. A configured URL, successful deployment command, or control-plane
login is not readiness evidence by itself.

### Prefer a run-owned Kubernetes port-forward

When a local Runner needs application access and the connection mechanism is not itself under test,
prefer a project-owned port-forward that the quality run starts, probes, observes, and stops over an
ambient host VPN or manually shared tunnel. Use the project's wrapper when one exists; otherwise
bind the forward to the resolved Service or Pod and target port, choose a run-scoped local port,
preserve logical service authority such as TLS SNI or HTTP `Host` when the protocol requires it,
retain the forwarder's logs, and make readiness and shutdown part of Environment evidence. A
run-owned connection path is reproducible and keeps unrelated reconnects or shared host state from
invalidating the run.

Do not substitute a port-forward when Service DNS, ingress, VPN behavior, or another network path is
part of the behavior being verified. For performance runs, also treat the forwarder as Runner
capacity: use it only when it can carry the declared profile without becoming an unmeasured
bottleneck. Otherwise use an authorized direct path or in-environment Runner and report the changed
Connection.

If connection setup fails, distinguish an unavailable Target, a broken Runner-to-Target path, and a
Runner error. An alternate endpoint, tunnel, or Runner is a changed Environment: verify it,
preserve the first failure, and report the changed execution conditions rather than silently
retrying for green.

## Prepare the environment

Keep these preparation kinds visible because they have different failure and cleanup semantics:

1. **Pre-existing conditions** come from the selected Target, such as a deployed revision, enabled
   capability, dependency, quota, or resource policy.
2. **Run-owned fixtures** are created for the run. Give them stable run identity, isolate them from
   concurrent work, and clean them through project-owned mechanisms.
3. **Transient controls** deliberately alter behavior for a bounded period. Apply them only after
   steady-state readiness is proven, verify activation, and always restore them.

Do not infer readiness from setup exit status. Observe each condition at the layer the scenario
depends on. An absent required condition makes the run `blocked` or `error`; it is not a product
pass and must not be silently removed from the realized Environment.

## Follow the lifecycle

1. Read the project runbook nearest to the selected capability.
2. Resolve Target, Runner, Connection, conditions, effects, and evidence.
3. Check authorization before deploying, creating durable data, changing resources, injecting
   faults, or generating material load.
4. Prepare preconditions and fixtures through canonical mechanisms.
5. Verify Target health and application connectivity from observable state.
6. Apply and verify transient controls.
7. Execute without silently repairing or changing the Environment during measurement.
8. Remove controls, clean fixtures, stop connection helpers, and verify restoration even after a
   failed run.

Cleanup is evidence, not a business verdict. A capability may pass its assertions or SLOs and still
finish with a cleanup error; report both outcomes.

## Preserve evidence safely

Retain the project and Runner revision, Target identity, connection path, endpoint identity,
application readiness, conditions and controls, fixtures, start/end time, cleanup, native Verdict,
and artifact paths. Keep credentials, private endpoint details, and volatile environment facts out
of reusable plugin guidance.

# Environment preparation

Read [Quality concepts](../CONCEPTS.md) for Environment, Service, Workload, and execution identity.
This contract prepares live E2E and performance runs. Offline analysis of existing evidence does
not require a live target or connection preparation.

Run conditions include the selected target, test-process location, connection, prerequisites,
fixtures, temporary controls, and cleanup. Record them separately from Environment identity so a
changed network path or test location remains visible without inventing another environment.

The project owns startup and access mechanisms, credentials, fixtures, controls, and cleanup.
Use its canonical entrypoint and runbook to prepare and verify these conditions.

## Resolve the target and execution location

Resolve in order:

1. **Target:** identify the Service or system boundary, Environment, deployed revision,
   configuration, namespace or other scope, and whether it is dedicated or shared.
2. **Execution location:** decide where the quality command and traffic generator execute after
   the target is fixed. Record the test-process revision separately from the target revision.
3. **Connection:** select and verify the application data-plane path from that process to the target.

Do not infer the target from whichever endpoint happens to respond. Resolve the endpoint from
project configuration and target state, then probe its exact host, port, and protocol from the
actual execution location. Confirm the deployed revision and health independently when applicable.

For a local target, use the project's startup or discovery mechanism. For Kubernetes, API or
`kubectl` access proves control-plane reachability only. Neither it nor a configured Service or
Workload proves that the test process can exchange application traffic with the target.

### Choose the Kubernetes connection by priority

When the connection mechanism is not itself under test, use the first applicable authorized option:

1. **Run-owned port-forward:** prefer a project-owned forward that the run starts, probes,
   observes, and stops. Use the project's wrapper when available; otherwise resolve the Kubernetes
   Service or Pod and target port, choose a run-scoped local port, preserve TLS SNI or HTTP `Host`,
   and own readiness, logs, and shutdown.
2. **Direct application endpoint:** use project-owned ingress or a routable `ClusterIP:port`.
   For a normal Kubernetes Service, prefer ClusterIP over Service DNS to avoid ambient DNS and VPN
   dependencies while retaining the Service data plane. Preserve TLS SNI, HTTP `Host`, service-mesh
   routing, and other logical authority through project configuration. Use Service DNS when
   ClusterIP is not routable or DNS is required by the intended path or behavior.
3. **In-environment execution:** move the test process into the target Environment when local
   access is unavailable or unsuitable, and report the changed execution location.
4. **Ambient VPN or shared tunnel:** use this when earlier options are unavailable or the project
   requires that path; verify it for this run rather than trusting existing host state.

Do not substitute a port-forward when Service DNS, ingress, VPN behavior, or another network path
is under test. For performance work, assess the connection helper's capacity as part of the load
path. If it could bottleneck the declared capacity, stress, or soak profile, use an authorized
direct path or in-environment execution and record the chosen connection.

If setup fails, distinguish an unavailable target, a broken connection, and a test-process error.
Verify any alternate path, preserve the first failure, and report changed execution conditions.
An endpoint or execution-location change is not automatically a change in Environment identity.

## Prepare conditions and effects

Keep preparation kinds visible because they have different failure and cleanup semantics:

1. **Pre-existing conditions** include the target revision, enabled capabilities, dependencies,
   quotas, and resource policy.
2. **Run-owned fixtures** are records, identities, files, or other resources created for this run.
   Give them stable run identity, isolate concurrent work, and clean them through project mechanisms.
3. **Transient controls** deliberately alter behavior for a bounded period, such as fault injection,
   load, or a resource setting. Verify steady state first, then activation, and always restore them.

Observe each required condition at the layer the scenario depends on. Setup exit status alone is
not readiness evidence. If a required condition is missing, preserve the `blocked` or `error` state
and identify that condition rather than silently removing it from the run.

## Follow the lifecycle

1. Read the project runbook nearest to the selected capability.
2. Resolve the target, execution location, connection, required conditions, and expected effects.
3. Check existing authorization before deployment, durable-data creation, resource changes, fault
   injection, or material load; obtain authorization for actions outside it.
4. Prepare prerequisites and fixtures through canonical mechanisms.
5. Verify target health and application connectivity from observable state.
6. Apply and verify transient controls.
7. Execute under the declared conditions; record deviations instead of silently repairing the
   target or connection during measurement.
8. Remove controls, clean fixtures, stop connection helpers, and verify restoration even after failure.

Keep assertions or SLO results and cleanup health separately visible. A successful assertion does
not erase a cleanup error or override the native run-level Verdict.

## Preserve run evidence

Retain the target and test-process revisions, Environment and Service identity, relevant Workload
instances, execution location, connection and endpoint identity, readiness observations, conditions,
controls, fixture identities, start/end times, and cleanup. Include native results and artifact
paths under the provenance and privacy rules in Quality concepts.

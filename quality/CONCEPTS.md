# Quality concepts

E2E, performance, and trajectory skills use these semantics to identify the subject, operate a
project capability, and interpret its evidence. Read this document before selecting a capability
or interpreting a run. Domain workflows and preparation live in the skills and their references.

## Ownership

- The framework provides execution, collection, evaluation, reduction, and reporting mechanisms.
- The project owns Cases, adapters, profiles, recordings, annotations, judgment criteria, target
  policy, and the canonical entrypoint. Use that entrypoint when one exists.
- The skill discovers and operates the capability, explains evidence, and improves project-owned
  assets within the user's request. Framework presence alone does not establish usable coverage.

These concepts align with the [quality-harness kernel](https://github.com/compforge/quality-harness/blob/main/docs/kernel.md).
Map native project artifacts to their semantic roles; shared classes, field names, and file formats
are not prerequisites. Check the project's actual SDK and artifact contracts before invoking an API
or assuming that a model has been persisted.

## Subject and runtime identity

| Concept | Meaning and evidence to resolve |
|---|---|
| Repository | Source identity within a Forge, such as GitHub or GitLab; record its revision separately. |
| Component | A unit in a Repository that can be independently built or released. |
| Environment | A named deployment and runtime environment; identify its scope and configuration. |
| Host | An optional environment access host. A cluster access host does not prove where an application process ran. |
| Service | A Component's named runtime presence in an Environment; resolve the deployed revision independently. |
| Workload | A named platform carrier declared by a Service; discover its actual instances and state at execution time. |
| Operation | A named capability exposed by a Service; protocol details belong to its adapter and access configuration. |

A logical Service may use several Workloads. Neither a declared Workload nor a configured endpoint
proves readiness, and a logical Service is not necessarily a Kubernetes Service resource. Bind
evidence to the relevant service, workload instances, and time instead of inferring identity from
an address or display label.

The **target** is the subject selected for the task. For live testing, identify its Service,
Environment, revision, and scope; for offline analysis, identify the recorded source and cohort.
Record the quality command's execution location and connection path as run conditions. Moving the
test process or changing its connection need not change Environment identity, but changes the
conditions under which results can be compared. See [environment preparation](references/environment.md).

## Intent and execution facts

A **Case** is reusable test intent with stable identity. Canonical Case assets belong to spec-case
when the project uses it; profiles select Cases and experiment-local weights without rewriting
their inputs or expected behavior. An **Experiment** names reproducible verification intent.

```text
ExperimentRun
  → Execution
      → OperationRun
          → Outcome

Reducer(recorded run facts) → Artifact → Report / Verdict
```

An ExperimentRun is one actual execution. Each domain owns its grouping and lifecycle: E2E can use
CaseRun, while perf uses ArmRun for one resource/load configuration. An OperationRun records one
real service invocation and owns its raw Outcome. A multistep Case may produce several calls; a
perf Case can be selected repeatedly. Keep configuration identity, execution identity, and call
identity distinct when joining evidence.

A **Reducer** derives **Artifacts** from recorded facts without calling the subject again. A
**Report** renders those artifacts. Inspect native run IDs, call IDs, manifests, and raw records;
do not reconstruct identity from report labels. Analysis of existing traces or trajectories does
not require inventing an Experiment, Case, or service call.

## Evidence and evaluation

| Concept | Semantic role |
|---|---|
| Observation | What execution or collection actually observed, with source identity and provenance. Outcome and recorded trajectory data are examples. |
| Unit | The domain's addressable evaluation grain, such as a request, window, Case, or trajectory. |
| Annotation | Supervision already available for evaluation, such as a human label or reference, with producer and provenance. |
| Dataset | Reusable, versioned Unit facts and their Case, Observation, and Annotation relationships. |
| EvaluationRun | One evaluation of those facts under selected components, versions, configuration, and policy. |
| Finding | An evidenced pattern or anomaly; it may motivate investigation but is not a quality verdict or proven cause. |
| Measurement | A factual value derived from evidence, such as latency, tokens, or resource use. |
| Evaluation | A judgment against an explicit criterion, produced by a Judge, Verifier, assertion, or other native evaluator. |
| Worksheet | The evaluation's rows of Unit facts and results, including missing or errored cells. This is a semantic view, not a required file format. |
| Verdict | The run-level, machine-consumable decision under the declared policy. |

Preserve the source facts when judgment fails. Missing evaluation is not an observed product
failure. Read execution health and result coverage before interpreting scores or aggregates; a
Finding or Measurement affects a gate only through an explicit judgment or policy.

Keep one grain and stable key per analysis table. Request, window, and run aggregates answer
different questions. Use native artifacts when available rather than inventing Dataset,
EvaluationRun, or Worksheet files that the project does not produce.

## Reuse and comparison

Record subject or generator revision, evidence identity/version, and evaluation configuration
separately. Changing source facts, Cases, or annotations changes the dataset. Changing judgment
rules or analysis configuration can reuse the same facts in a distinct evaluation when the native
capability supports it. Rendering a report neither recollects evidence nor reruns judgment.

Comparing subject behavior requires separate executions with aligned inputs and controlled run
conditions. Comparing judgment components requires fixed source evidence. Identify unmatched
factors, missing observations, and coverage denominators before attributing differences to a
revision. Domain skills define the remaining comparability requirements.

## Capability, health, and decision

Keep three questions separate:

1. **Can this task run?** `ready` means its selected action has the necessary capability and inputs;
   `blocked` means a prerequisite is unavailable; `no_capability` means no usable project-owned
   entrypoint or sufficient evidence exists for the requested action. Offline analysis can be ready
   without a live target; live execution requires verified application connectivity.
2. **Did it execute correctly?** Preserve errors, cancellations, missing observations, partial
   evaluation coverage, and cleanup failures. Configured components may not have executed.
3. **What passed?** Preserve native verdict states and their scope. Skipped or missing judgments
   are not passes; analysis without a gate policy does not prove release readiness. Passing
   assertions or SLOs do not erase an execution or cleanup error.

Report the decision with its subject and provenance, realized conditions, command or evidence
source, coverage, native result, and artifact paths. Keep run-specific facts and reusable project
operating knowledge beside the project's assets; keep credentials, private data, and volatile
environment details out of the plugin.

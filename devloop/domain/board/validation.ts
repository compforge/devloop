import { listValidationRuns, snapshot } from "@compforge/repokit";

/**
 * @spec Board displays retained executions, never a current pass or a reuse decision.
 * A source comparison does not attest the toolchain, environment or declared external inputs.
 * @see {@link component://docs/repository-toolkit.md}
 */
export async function validationHistory(repo: string): Promise<Record<string, unknown>> {
  const signal = AbortSignal.timeout(1_000);
  try {
    const history = await listValidationRuns({repository: repo, checkout: repo, limit: 3, includeInputs: true, signal});
    if (!history.total) return {total: 0, runs: []};
    // Input summaries are read in one SDK query; only source capture spends the remaining budget.
    const current = await snapshot(repo, {signal}).catch(() => undefined);
    const runs = history.runs.map(run => {
      let sourceState = "unknown";
      if (current?.complete && run.inputs?.complete) sourceState = current.digest === run.inputs.snapshot ? "unchanged" : "changed";
      return {runID: run.runID, component: run.component, check: run.check, status: run.status,
        scope: run.scope, startedAt: run.startedAt, inputsConsistent: run.inputsConsistent,
        sourceState, inputsComplete: run.inputs?.complete ?? false};
    });
    return {total: history.total, hasMore: history.hasMore, runs};
  } catch (error) {
    return {error: `Validation history unavailable: ${error instanceof Error ? error.message : String(error)}`};
  }
}

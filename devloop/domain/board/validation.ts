import { listValidationRuns, readValidationRun, snapshot } from "@compforge/repokit";

/**
 * @spec Board displays retained executions, never a current pass or a reuse decision.
 * A source comparison does not attest the toolchain, environment or declared external inputs.
 * @see {@link component://docs/repository-toolkit.md}
 */
export async function validationHistory(repo: string): Promise<Record<string, unknown>> {
  const signal = AbortSignal.timeout(1_000);
  try {
    const history = await listValidationRuns({repository: repo, checkout: repo, limit: 3, signal});
    if (!history.total) return {total: 0, runs: []};
    // Retained summaries remain useful when comparison or evidence exceeds the shared read budget.
    const current = await snapshot(repo, {signal}).catch(() => undefined);
    const runs = await Promise.all(history.runs.map(async run => {
      const detail = await readValidationRun(repo, run.runID, {signal}).catch(() => undefined);
      let sourceState = "unknown";
      if (current?.complete && detail?.inputs) sourceState = current.digest === detail.inputs.snapshot ? "unchanged" : "changed";
      return {runID: run.runID, component: run.component, check: run.check, status: run.status,
        scope: run.scope, startedAt: run.startedAt, inputsConsistent: run.inputsConsistent,
        sourceState, evidenceComplete: detail?.complete ?? false};
    }));
    return {total: history.total, hasMore: history.hasMore, runs};
  } catch (error) {
    return {error: `Validation history unavailable: ${error instanceof Error ? error.message : String(error)}`};
  }
}

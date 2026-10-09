/** @why A detached one-shot task is independent of the hook's admission/Board runtime.
 * The shared claim covers its whole process lifetime, including uv startup, so slow
 * Forge sweeps cannot pile up when several sessions keep emitting tool events.
 */
export declare function triggerReconciliation(repo: string): boolean;
//# sourceMappingURL=task-trigger.d.ts.map
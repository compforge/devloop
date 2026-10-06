import { type HookPayload, type ProcessHookAdapter } from "./hook-payload.js";
/** Codex's process-hook dialect mapped onto the shared policy core. */
export declare function evaluateCodexPreTool(payload: HookPayload): Promise<Record<string, unknown>>;
/** Codex reports failed executions through PostToolUse as well as successful ones. */
export declare function codexToolFailed(payload: HookPayload): boolean;
export declare const codexProcessAdapter: ProcessHookAdapter;
//# sourceMappingURL=codex.d.ts.map
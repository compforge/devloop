export type HookHarness = "claude" | "codex";
export interface ProcessHookAdapter {
    readonly harness: HookHarness;
    preTool(payload: HookPayload): Record<string, unknown>;
}
export interface HookPayload {
    readonly hook_event_name?: unknown;
    readonly tool_name?: unknown;
    readonly tool_input?: unknown;
    readonly cwd?: unknown;
    readonly session_id?: unknown;
    readonly model?: unknown;
    readonly [key: string]: unknown;
}
export declare function preToolDecision(payload: HookPayload, configured?: HookHarness): Record<string, unknown>;
//# sourceMappingURL=hook-payload.d.ts.map
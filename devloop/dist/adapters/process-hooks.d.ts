import { BoardRuntime } from "../domain/board/runtime.js";
import type { HookHarness, HookPayload } from "./hook-payload.js";
export type RuntimeHarness = HookHarness | "dsh";
/** Refresh discoverable workspace facts and construct the shared Board for session startup. */
export declare function initializeBoard(payload: HookPayload): {
    readonly runtime?: BoardRuntime;
    readonly watchPaths: readonly string[];
};
export declare function sessionStartOutput(payload: HookPayload, harness?: HookHarness): Record<string, unknown>;
export declare function userPromptOutput(payload: HookPayload): Record<string, unknown>;
export declare function afterCompact(payload: HookPayload): void;
export declare function afterCwdChanged(payload: HookPayload): void;
export declare function afterTool(payload: HookPayload, harness: RuntimeHarness): void;
export declare function afterFileChanged(payload: HookPayload): void;
/** Record tool timing in the same TypeScript process that evaluates hook policy. */
export declare function recordToolCall(payload: HookPayload, harness: RuntimeHarness): void;
export declare function endSession(payload: HookPayload, harness: RuntimeHarness): void;
//# sourceMappingURL=process-hooks.d.ts.map
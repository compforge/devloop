import type { JsonObject } from "../../lib/config.js";
export declare const TOOL_CALL_SCHEMA = "devloop.tool-call/v1";
export declare function appendToolCall(root: string, record: JsonObject, at?: number): void;
export declare function toolCallStartedAt(root: string, callId: string, at?: number): number | undefined;
//# sourceMappingURL=tool-calls.d.ts.map
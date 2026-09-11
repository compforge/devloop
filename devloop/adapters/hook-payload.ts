import { deniedReason } from "../hooks/core/policy.js";

export type HookHarness = "claude" | "codex";

export interface HookPayload {
  readonly hook_event_name?: unknown;
  readonly tool_name?: unknown;
  readonly tool_input?: unknown;
  readonly cwd?: unknown;
  readonly session_id?: unknown;
  readonly model?: unknown;
  readonly [key: string]: unknown;
}

export function harnessFromPayload(payload: HookPayload, configured?: HookHarness): HookHarness {
  if (configured) return configured;
  return typeof payload.model === "string" ? "codex" : "claude";
}

export function preToolDecision(payload: HookPayload, configured?: HookHarness): Record<string, unknown> {
  const harness = harnessFromPayload(payload, configured);
  const rawInput = payload.tool_input;
  const toolInput: Record<string, unknown> = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput)
    ? { ...rawInput as Record<string, unknown> }
    : { input: String(rawInput ?? "") };
  if (typeof payload.session_id === "string") toolInput.session_id = payload.session_id;
  const reason = deniedReason({
    harness,
    toolName: typeof payload.tool_name === "string" ? payload.tool_name : "",
    toolInput,
    cwd: typeof payload.cwd === "string" ? payload.cwd : process.cwd(),
  });
  if (!reason) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
    systemMessage: reason,
  };
}

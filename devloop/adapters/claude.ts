import { preToolDecision, type HookPayload } from "./hook-payload.js";

/** Claude Code's process-hook dialect mapped onto the shared policy core. */
export function evaluateClaudePreTool(payload: HookPayload): Record<string, unknown> {
  return preToolDecision(payload, "claude");
}

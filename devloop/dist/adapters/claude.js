import { preToolDecision } from "./hook-payload.js";
/** Claude Code's process-hook dialect mapped onto the shared policy core. */
export function evaluateClaudePreTool(payload) {
    return preToolDecision(payload, "claude");
}
//# sourceMappingURL=claude.js.map
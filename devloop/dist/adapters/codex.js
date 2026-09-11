import { preToolDecision } from "./hook-payload.js";
/** Codex's process-hook dialect mapped onto the shared policy core. */
export function evaluateCodexPreTool(payload) {
    return preToolDecision(payload, "codex");
}
export const codexProcessAdapter = {
    harness: "codex",
    preTool: evaluateCodexPreTool,
};
//# sourceMappingURL=codex.js.map
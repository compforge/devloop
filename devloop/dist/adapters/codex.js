import { preToolDecision } from "./hook-payload.js";
/** Codex's process-hook dialect mapped onto the shared policy core. */
export function evaluateCodexPreTool(payload) {
    return preToolDecision(payload, "codex");
}
/** Codex reports failed executions through PostToolUse as well as successful ones. */
export function codexToolFailed(payload) {
    const response = payload.tool_response;
    if (typeof payload.tool_name === "string" && payload.tool_name.startsWith("mcp__")) {
        return response !== null && typeof response === "object" && !Array.isArray(response)
            && response.isError === true;
    }
    if (!["Bash", "apply_patch"].includes(String(payload.tool_name)) || typeof response !== "string")
        return false;
    // Only read the host's result header: command stdout may itself contain exit-code examples.
    const outputStart = response.indexOf("\nOutput:");
    if (outputStart < 0)
        return false;
    const header = response.slice(0, outputStart);
    const exitCode = /^(?:Exit code: |Process exited with code )(-?\d+)$/m.exec(header);
    return exitCode !== null && Number(exitCode[1]) !== 0;
}
export const codexProcessAdapter = {
    harness: "codex",
    preTool: evaluateCodexPreTool,
};
//# sourceMappingURL=codex.js.map
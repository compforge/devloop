import { createUserMessage } from "@deepseek-ai/dsh-llm";
import Schema from "@deepseek-ai/schemastery";
import { BoardRuntime } from "../domain/board/runtime.js";
import { afterTool, endSession, initializeBoard, recordToolCall } from "./process-hooks.js";
import { decisionMessage } from "../hooks/core/domain.js";
import { evaluateTool } from "../hooks/core/policy.js";
export const name = "devloop";
// The adapter only registers listeners, but those listeners belong to the agent/tool
// runtimes. Declaring both owners keeps Cordis from activating this plugin while the
// DSH profile loader is still replacing their service fibers.
export const inject = ["agents", "tools"];
/** DSH validates bundle configuration before mounting the plugin. */
export const Config = Schema.object({
    cwd: Schema.string(),
});
/** Native Cordis adapter. Domain and policy behavior remains in the shared core. */
export function apply(ctx, config = {}) {
    const boardFor = (agent) => BoardRuntime.resolve(agent.session.header.cwd ?? config.cwd ?? process.cwd(), String(agent.id));
    const contextMessage = (content) => createUserMessage({
        content: [{ type: "text", text: content }],
        source: { kind: "plugin", plugin: name },
    });
    ctx.on("agent/session-start", ({ agent, source }) => {
        const board = initializeBoard({
            cwd: agent.session.header.cwd ?? config.cwd ?? process.cwd(),
            session_id: String(agent.id),
        }).runtime ?? boardFor(agent);
        if (!board)
            return;
        if (source === "compact")
            board.afterCompact();
        const content = board.deliverPrompt("session_start");
        if (content)
            agent.inject(contextMessage(content));
    });
    ctx.on("agent/pre-step", async ({ agent }, next) => {
        const downstream = await next();
        if (downstream.kind !== "enter")
            return downstream;
        const content = boardFor(agent)?.deliverPrompt("user_prompt");
        return content && downstream.kind === "enter"
            ? { kind: "enter", messages: [...downstream.messages, contextMessage(content)] }
            : downstream;
    });
    ctx.on("tools/pre-execute", async (exec, next) => {
        const raw = exec.arguments;
        const toolInput = raw !== null && typeof raw === "object" && !Array.isArray(raw)
            ? { ...raw }
            : { input: String(raw ?? "") };
        const sessionId = exec.agent ? String(exec.agent.id) : "";
        toolInput.session_id = sessionId;
        recordToolCall({
            hook_event_name: "PreToolUse", tool_name: exec.name, tool_input: toolInput,
            cwd: exec.agent?.session.header.cwd ?? config.cwd ?? process.cwd(), session_id: sessionId,
        }, "dsh");
        const result = evaluateTool({
            harness: "dsh",
            toolName: exec.name,
            toolInput,
            cwd: exec.agent?.session.header.cwd ?? config.cwd ?? process.cwd(),
        });
        if (result.action === "deny")
            return { kind: "deny", reason: decisionMessage(result) };
        if (result.action === "warn")
            ctx.logger("devloop").warn(decisionMessage(result));
        return next();
    });
    ctx.on("tools/post-execute", async (exec, result, next) => {
        const downstream = await next();
        const payload = {
            hook_event_name: result.isError ? "PostToolUseFailure" : "PostToolUse",
            tool_name: exec.name,
            tool_input: exec.arguments,
            cwd: exec.agent?.session.header.cwd ?? config.cwd ?? process.cwd(),
            session_id: exec.agent ? String(exec.agent.id) : "",
        };
        recordToolCall(payload, "dsh");
        if (!result.isError) {
            afterTool(payload, "dsh");
        }
        return downstream;
    });
    ctx.on("agent/disposed", ({ agent }) => {
        endSession({
            cwd: agent.session.header.cwd ?? config.cwd ?? process.cwd(),
            session_id: String(agent.id),
        }, "dsh");
    });
}
//# sourceMappingURL=dsh.js.map
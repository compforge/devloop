import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { BoardRuntime } from "../domain/board/runtime.js";
import { afterTool, initializeBoard } from "./process-hooks.js";
import { clearActiveRepo, releaseOwner } from "../domain/context/session.js";
import { decisionMessage } from "../hooks/core/domain.js";
import { evaluateTool } from "../hooks/core/policy.js";
export const name = "devloop";
export const inject = [];
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
        if (!result.isError) {
            afterTool({
                hook_event_name: "PostToolUse",
                tool_name: exec.name,
                tool_input: exec.arguments,
                cwd: exec.agent?.session.header.cwd ?? config.cwd ?? process.cwd(),
                session_id: exec.agent ? String(exec.agent.id) : "",
            }, "dsh");
        }
        return downstream;
    });
    ctx.on("agent/disposed", ({ agent }) => {
        const board = boardFor(agent);
        if (!board)
            return;
        board.close();
        if (board.repo)
            releaseOwner(board.repo, { harness: "dsh", sessionId: String(agent.id) });
        if (board.repo && board.root !== board.repo)
            clearActiveRepo(board.root, String(agent.id));
    });
}
//# sourceMappingURL=dsh.js.map
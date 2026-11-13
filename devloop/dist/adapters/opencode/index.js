import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { initializeBoard, afterTool, endSession, recordToolCall } from "../process-hooks.js";
import { BoardRuntime } from "../../domain/board/runtime.js";
import { findGitRoot } from "../../domain/repo-layout.js";
import { decisionMessage } from "../../hooks/core/domain.js";
import { projectTool } from "../../hooks/core/project.js";
import { releaseOwner } from "../../domain/context/session.js";
import { evaluateTool } from "../../hooks/core/policy.js";
const parent = fileURLToPath(new URL("../../", import.meta.url));
const pluginRoot = existsSync(join(parent, "package.json")) ? parent : fileURLToPath(new URL("../../../", import.meta.url));
function log(event, error, sessionId, cwd) {
    console.error(JSON.stringify({ plugin: "devloop", event, session_id: sessionId, cwd, error: error instanceof Error ? error.message : String(error) }));
}
function inputRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? { ...value } : { input: String(value ?? "") };
}
function bundledSkills() {
    return readdirSync(join(pluginRoot, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
        const path = join(pluginRoot, "skills", entry.name, "SKILL.md");
        const source = readFileSync(path, "utf8");
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
        if (!frontmatter)
            throw new Error(`Missing skill frontmatter: ${path}`);
        const metadata = parse(frontmatter[1]);
        const fields = inputRecord(metadata);
        if (typeof fields.name !== "string" || typeof fields.description !== "string")
            throw new Error(`Invalid skill name/description: ${path}`);
        return {
            id: `devloop:${fields.name}`,
            name: fields.name,
            description: fields.description,
            path: path,
            content: source.slice(frontmatter[0].length).replaceAll("<PLUGIN_ROOT>", pluginRoot),
        };
    });
}
/**
 * @spec OpenCode request-local Board context remains visible throughout a user turn.
 * @why Context hooks are not durable history; consuming a queue cannot preserve them across requests.
 * @link ../../docs/harness-adapters.md
 * @case ../../tests/opencode.spec.ts
 */
async function setup(ctx) {
    const sessions = new Map();
    const shellSession = new AsyncLocalStorage();
    // CodeMode reuses the outer call ID for child tools. Input identity survives
    // before/after hooks and distinguishes nested/concurrent object invocations.
    const calls = new WeakMap();
    let sequence = 0;
    const callId = (event, start = false) => {
        const fallback = `${event.id}:${event.tool}`;
        if (event.input === null || typeof event.input !== "object")
            return fallback;
        if (start)
            calls.set(event.input, `${fallback}:${++sequence}`);
        return calls.get(event.input) ?? fallback;
    };
    const skills = bundledSkills();
    await ctx.skill.transform((editor) => { for (const skill of skills)
        editor.add(skill); });
    // Wrap only the native shell executor. AsyncLocalStorage carries identity through
    // the host's Promise/Effect bridge without mutating the shared server environment.
    await ctx.tool.transform((editor) => {
        editor.update("shell", (tool) => {
            const execute = tool.execute;
            tool.execute = (input, context) => shellSession.run(context.sessionID, () => execute(input, context));
        });
    });
    await ctx.shell.hook("create.before", (event) => {
        const sessionId = shellSession.getStore();
        if (!sessionId)
            return;
        event.env.DEVLOOP_HARNESS = "opencode";
        event.env.DEVLOOP_SESSION_ID = sessionId;
        event.env.PLUGIN_ROOT = pluginRoot;
    });
    const stateFor = async (sessionID) => {
        // A plugin location can observe other locations. Resolve the session's current
        // location rather than using process.cwd or ctx.location for tool admission.
        const session = await ctx.session.get({ sessionID });
        const cwd = resolve(session.location.directory, session.subpath ?? ".");
        let state = sessions.get(sessionID);
        if (!state) {
            state = { cwd, roots: new Set([cwd]) };
            sessions.set(sessionID, state);
            try {
                await initializeBoard({ cwd, session_id: sessionID }, "opencode");
            }
            catch (error) {
                log("board_initialization_failed", error, sessionID, cwd);
            }
        }
        else if (state.cwd !== cwd) {
            state.cwd = cwd;
            state.roots.add(cwd);
            try {
                await initializeBoard({ cwd, session_id: sessionID }, "opencode");
            }
            catch (error) {
                log("board_initialization_failed", error, sessionID, cwd);
            }
        }
        return state;
    };
    await ctx.session.hook("context", async (event) => {
        try {
            const state = await stateFor(event.sessionID);
            const board = await BoardRuntime.resolve(state.cwd, event.sessionID, "opencode");
            if (!board)
                return;
            const content = await board.text();
            if (content)
                event.system.push({ type: "text", text: content });
        }
        catch (error) {
            log("context_failed", error, event.sessionID);
        }
    });
    /**
     * @spec Auxiliary Board, checkout tracking and ledger failures cannot bypass policy admission.
     * @case ../../tests/opencode.spec.ts
     */
    const beforeTool = async (event) => {
        let state;
        try {
            state = await stateFor(event.sessionID);
        }
        catch (error) {
            log("session_location_failed", error, event.sessionID);
            return;
        }
        const invocation = callId(event, true);
        const toolInput = { ...inputRecord(event.input), session_id: event.sessionID };
        const input = { harness: "opencode", toolName: event.tool, toolInput, cwd: state.cwd };
        const payload = { tool_name: event.tool, tool_input: toolInput, tool_use_id: invocation, cwd: state.cwd, session_id: event.sessionID };
        try {
            recordToolCall({ ...payload, hook_event_name: "PreToolUse" }, "opencode");
        }
        catch (error) {
            log("tool_recording_failed", error, event.sessionID, state.cwd);
        }
        let denial;
        try {
            const decision = await evaluateTool(input);
            if (decision.action === "deny") {
                denial = decisionMessage(decision);
                log("tool_denied", denial, event.sessionID);
            }
            else if (decision.action === "warn")
                log("tool_warning", decisionMessage(decision), event.sessionID);
        }
        catch (error) {
            log("admission_failed", error, event.sessionID);
        }
        for (const target of projectTool(input).targets) {
            const directory = target.kind === "file_change" ? dirname(resolve(state.cwd, target.path)) : target.workingDirectory.path;
            if (!directory)
                continue;
            try {
                const repo = findGitRoot(directory);
                if (repo)
                    state.roots.add(repo);
            }
            catch (error) {
                log("checkout_tracking_failed", error, event.sessionID, directory);
            }
        }
        try {
            if (denial)
                recordToolCall({ ...payload, hook_event_name: "PostToolUseFailure" }, "opencode");
        }
        catch (error) {
            log("tool_recording_failed", error, event.sessionID, state.cwd);
        }
        // The Promise host turns this into a Tool.Error, including a CodeMode child call.
        if (denial)
            throw new Error(denial);
    };
    await ctx.tool.hook("execute.before", beforeTool);
    await ctx.tool.hook("execute.after", async (event) => {
        try {
            const state = await stateFor(event.sessionID);
            const output = event.status === "completed" ? inputRecord(event.result.output) : {};
            // A background shell has not completed. Its later terminal result is not a
            // successful foreground git mutation and must not claim ownership here.
            if (event.tool === "shell" && output.status === "running")
                return;
            const failed = event.status === "error" || event.tool === "execute" && output.error === true || event.tool === "shell" && (typeof output.exit === "number" && output.exit !== 0 || output.timeout === true || typeof output.signal === "string");
            const payload = { hook_event_name: failed ? "PostToolUseFailure" : "PostToolUse", tool_name: event.tool, tool_input: event.input, tool_use_id: callId(event), cwd: state.cwd, session_id: event.sessionID };
            recordToolCall(payload, "opencode");
            if (!failed)
                afterTool(payload, "opencode");
        }
        catch (error) {
            log("after_tool_failed", error, event.sessionID);
        }
    });
    /**
     * @spec An unavailable checkout must not prevent cleanup of other checkouts or sessions.
     * @case ../../tests/opencode.spec.ts
     */
    const close = async (sessionId) => {
        const state = sessions.get(sessionId);
        if (!state)
            return;
        for (const cwd of state.roots) {
            try {
                await endSession({ cwd, session_id: sessionId }, "opencode");
            }
            catch (error) {
                log("session_cleanup_failed", error, sessionId, cwd);
            }
        }
        sessions.delete(sessionId);
    };
    const events = new AbortController();
    void (async () => {
        for await (const event of ctx.event.subscribe({ signal: events.signal })) {
            if (event.type === "session.deleted")
                await close(event.data.sessionID);
            if (["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"].includes(event.type) && "sessionID" in event.data) {
                const sessionId = String(event.data.sessionID);
                for (const cwd of sessions.get(sessionId)?.roots ?? []) {
                    try {
                        const repo = findGitRoot(cwd);
                        if (repo)
                            releaseOwner(repo, { harness: "opencode", sessionId });
                    }
                    catch (error) {
                        log("owner_release_failed", error, sessionId, cwd);
                    }
                }
            }
        }
    })().catch((error) => { if (!events.signal.aborted)
        log("events_failed", error); });
    return async () => { events.abort(); for (const sessionId of sessions.keys())
        await close(sessionId); };
}
export default { id: "devloop", setup };
//# sourceMappingURL=index.js.map
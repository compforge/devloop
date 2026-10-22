import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context, Plugin } from "@opencode/plugin/promise/plugin";
import type { Session } from "@opencode/schema/session";
import type { Skill } from "@opencode/schema/skill";
import { parse } from "yaml";
import { initializeBoard, afterTool, endSession, recordToolCall } from "./process-hooks.js";
import { BoardRuntime } from "../domain/board/runtime.js";
import { itemsFor, promptFactsFor, PromptDelivery } from "../domain/board/delivery.js";
import { renderPrompt } from "../domain/board/render.js";
import { findGitRoot } from "../domain/repo-layout.js";
import { triggerReconciliation } from "../domain/task-trigger.js";
import { decisionMessage } from "../hooks/core/domain.js";
import { projectTool } from "../hooks/core/project.js";
import { releaseOwner } from "../domain/context/session.js";
import { evaluateTool } from "../hooks/core/policy.js";

const parent = fileURLToPath(new URL("../", import.meta.url));
const pluginRoot = existsSync(join(parent, "package.json")) ? parent : fileURLToPath(new URL("../../", import.meta.url));

function log(event: string, error: unknown, sessionId?: string): void {
  console.error(JSON.stringify({ plugin: "devloop", event, session_id: sessionId, error: error instanceof Error ? error.message : String(error) }));
}

function inputRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? { ...value as Record<string, unknown> } : { input: String(value ?? "") };
}

function bundledSkills(): Skill.Info[] {
  return readdirSync(join(pluginRoot, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const path = join(pluginRoot, "skills", entry.name, "SKILL.md");
    const source = readFileSync(path, "utf8");
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
    if (!frontmatter) throw new Error(`Missing skill frontmatter: ${path}`);
    const metadata: unknown = parse(frontmatter[1]!);
    const fields = inputRecord(metadata);
    if (typeof fields.name !== "string" || typeof fields.description !== "string") throw new Error(`Invalid skill name/description: ${path}`);
    return {
      id: `devloop:${fields.name}` as Skill.ID,
      name: fields.name as Skill.Name,
      description: fields.description,
      path: path as Skill.Info["path"],
      content: source.slice(frontmatter[0].length).replaceAll("<PLUGIN_ROOT>", pluginRoot),
    };
  });
}

interface SessionState {
  cwd: string;
  roots: Set<string>;
  selected?: Set<string>;
  compacted?: boolean;
}

/**
 * @spec OpenCode request-local Board context remains visible throughout a user turn.
 * @why Context hooks are not durable history; delivery receipts alone cannot replay them.
 * @link ../docs/harness-adapters.md
 * @case ../tests/opencode.spec.ts
 */
async function setup(ctx: Context): Promise<() => void> {
  const sessions = new Map<string, SessionState>();
  const shellSession = new AsyncLocalStorage<string>();
  // CodeMode reuses the outer call ID for child tools. Input identity survives
  // before/after hooks and distinguishes nested/concurrent object invocations.
  const calls = new WeakMap<object, string>();
  let sequence = 0;
  const callId = (event: { id: string; tool: string; input: unknown }, start = false): string => {
    const fallback = `${event.id}:${event.tool}`;
    if (event.input === null || typeof event.input !== "object") return fallback;
    if (start) calls.set(event.input, `${fallback}:${++sequence}`);
    return calls.get(event.input) ?? fallback;
  };
  const skills = bundledSkills();
  await ctx.skill.transform((editor) => { for (const skill of skills) editor.add(skill); });

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
    if (!sessionId) return;
    event.env.DEVLOOP_HARNESS = "opencode";
    event.env.DEVLOOP_SESSION_ID = sessionId;
    event.env.PLUGIN_ROOT = pluginRoot;
  });

  const stateFor = async (sessionID: Session.ID): Promise<SessionState> => {
    // A plugin location can observe other locations. Resolve the session's current
    // location rather than using process.cwd or ctx.location for tool admission.
    const session = await ctx.session.get({ sessionID });
    const cwd = resolve(session.location.directory, session.subpath ?? ".");
    let state = sessions.get(sessionID);
    if (!state) {
      state = { cwd, roots: new Set([cwd]) };
      sessions.set(sessionID, state);
      await initializeBoard({ cwd, session_id: sessionID });
      const repo = findGitRoot(cwd);
      if (repo) triggerReconciliation(repo, pluginRoot);
    } else if (state.cwd !== cwd) {
      state.cwd = cwd; state.roots.add(cwd); delete state.selected;
      await initializeBoard({ cwd, session_id: sessionID });
    }
    return state;
  };

  await ctx.session.hook("prompt", async (event) => {
    try { delete (await stateFor(event.sessionID)).selected; }
    catch (error) { log("prompt_failed", error, event.sessionID); }
  });
  await ctx.session.hook("compaction", (event) => {
    const state = sessions.get(event.sessionID);
    if (state) { state.compacted = true; delete state.selected; }
  });
  await ctx.session.hook("context", async (event) => {
    try {
      const state = await stateFor(event.sessionID);
      const board = await BoardRuntime.resolve(state.cwd, event.sessionID);
      if (!board) return;
      if (state.compacted) { board.afterCompact(); delete state.compacted; }
      if (!state.selected) {
        const due = new PromptDelivery(board.root, event.sessionID).deliverItems(board.view);
        state.selected = new Set(due.map((item) => item.id));
      }
      const facts = new Set(promptFactsFor(board.view).map((item) => item.id));
      const content = renderPrompt(itemsFor(board.view, "prompt").filter((item) => facts.has(item.id) || state.selected!.has(item.id)));
      if (content) event.system.push({ type: "text", text: content });
    } catch (error) { log("context_failed", error, event.sessionID); }
  });

  await ctx.tool.hook("execute.before", async (event) => {
    let denial: string | undefined;
    const invocation = callId(event, true);
    try {
      const state = await stateFor(event.sessionID);
      const toolInput = { ...inputRecord(event.input), session_id: event.sessionID };
      for (const target of projectTool({ harness: "opencode", toolName: event.tool, toolInput, cwd: state.cwd }).targets) {
        const directory = target.kind === "file_change" ? dirname(resolve(state.cwd, target.path)) : target.workingDirectory.path;
        if (directory) { const repo = findGitRoot(directory); if (repo) state.roots.add(repo); }
      }
      recordToolCall({ hook_event_name: "PreToolUse", tool_name: event.tool, tool_input: toolInput, tool_use_id: invocation, cwd: state.cwd, session_id: event.sessionID }, "opencode");
      const decision = await evaluateTool({ harness: "opencode", toolName: event.tool, toolInput, cwd: state.cwd });
      if (decision.action === "deny") {
        denial = decisionMessage(decision);
        recordToolCall({ hook_event_name: "PostToolUseFailure", tool_name: event.tool, tool_input: toolInput, tool_use_id: invocation, cwd: state.cwd, session_id: event.sessionID }, "opencode");
        log("tool_denied", denial, event.sessionID);
      } else if (decision.action === "warn") log("tool_warning", decisionMessage(decision), event.sessionID);
    } catch (error) { log("admission_failed", error, event.sessionID); }
    // Throw outside the fail-open boundary: the Promise host turns this into a
    // Tool.Error and rejects only this call, including a CodeMode child call.
    if (denial) throw new Error(denial);
  });
  await ctx.tool.hook("execute.after", async (event) => {
    try {
      const state = await stateFor(event.sessionID);
      const output = event.status === "completed" ? inputRecord(event.result.output) : {};
      // A background shell has not completed. Its later terminal result is not a
      // successful foreground git mutation and must not claim ownership here.
      if (event.tool === "shell" && output.status === "running") return;
      const failed = event.status === "error" || event.tool === "execute" && output.error === true || event.tool === "shell" && (typeof output.exit === "number" && output.exit !== 0 || output.timeout === true || typeof output.signal === "string");
      const payload = { hook_event_name: failed ? "PostToolUseFailure" : "PostToolUse", tool_name: event.tool, tool_input: event.input, tool_use_id: callId(event), cwd: state.cwd, session_id: event.sessionID };
      recordToolCall(payload, "opencode");
      if (!failed) afterTool(payload, "opencode", pluginRoot);
      const repo = findGitRoot(state.cwd);
      if (repo) triggerReconciliation(repo, pluginRoot);
    } catch (error) { log("after_tool_failed", error, event.sessionID); }
  });

  const close = (sessionId: string): void => {
    const state = sessions.get(sessionId);
    if (!state) return;
    for (const cwd of state.roots) endSession({ cwd, session_id: sessionId }, "opencode");
    sessions.delete(sessionId);
  };
  const events = new AbortController();
  void (async () => {
    for await (const event of ctx.event.subscribe({ signal: events.signal })) {
      if (event.type === "session.deleted") close(event.data.sessionID);
      if (["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"].includes(event.type) && "sessionID" in event.data) {
        const sessionId = String(event.data.sessionID);
        for (const cwd of sessions.get(sessionId)?.roots ?? []) {
          const repo = findGitRoot(cwd);
          if (repo) releaseOwner(repo, { harness: "opencode", sessionId });
        }
      }
    }
  })().catch((error: unknown) => { if (!events.signal.aborted) log("events_failed", error); });
  return () => { events.abort(); for (const sessionId of sessions.keys()) close(sessionId); };
}

export default { id: "devloop", setup } satisfies Plugin;

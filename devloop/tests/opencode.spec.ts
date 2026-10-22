import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "@opencode/plugin/promise/plugin";
import type { SessionContext, SessionPrompt } from "@opencode/plugin/promise/session";
import type { ShellCreateBefore } from "@opencode/plugin/promise/shell";
import type { Info, ToolContext } from "@opencode/plugin/promise/tool";
import type { Skill } from "@opencode/schema/skill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import plugin from "../adapters/opencode.js";
import { acquireOwner, readOwner } from "../domain/context/session.js";

type Callback = (event: never) => Promise<void> | void;
let root: string;
let hooks: Map<string, Callback>;
let skills: Skill.Info[];
let tools: Map<string, Info>;
let cleanup: (() => Promise<void> | void) | undefined;
let locations: Map<string, string>;
let publish: (event: unknown) => void;

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-opencode-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
  writeFileSync(join(root, "AGENTS.md"), "# Project\n\n## References\n\n- [Design](design.md) — Project behavior\n");
  writeFileSync(join(root, "design.md"), "# Design\n");
  hooks = new Map(); skills = []; tools = new Map(); locations = new Map();
  const register = (domain: string) => async (name: string, callback: Callback) => {
    hooks.set(`${domain}.${name}`, callback);
    return { dispose: async () => {} };
  };
  tools.set("shell", {
    name: "shell",
    execute: async (_input, context) => {
      // An async boundary and concurrent shell starts exercise the invocation scope.
      await new Promise((resolve) => setTimeout(resolve, context.sessionID.endsWith("a") ? 5 : 1));
      const event = { command: "true", cwd: root, timeout: 1000, shell: "sh", env: {} };
      await invoke("shell.create.before", event);
      return { output: event.env, content: "" };
    },
  } as Info);
  const pending: unknown[] = [];
  let wake: (() => void) | undefined;
  publish = (event) => { pending.push(event); wake?.(); };
  const context = {
    skill: { transform: async (callback: (editor: { add: (skill: Skill.Info) => void }) => void) => { callback({ add: (skill) => skills.push(skill) }); } },
    tool: {
      hook: register("tool"),
      transform: async (callback: (editor: { update: (id: string, update: (tool: Info) => void) => void }) => void) => {
        callback({ update: (id, update) => { const tool = tools.get(id); if (tool) update(tool); } });
      },
    },
    shell: { hook: register("shell") },
    session: {
      hook: register("session"),
      get: async ({ sessionID }: { sessionID: string }) => ({ location: { directory: locations.get(sessionID) ?? root } }),
    },
    event: { subscribe: ({ signal }: { signal: AbortSignal }) => ({ async *[Symbol.asyncIterator]() {
      signal.addEventListener("abort", () => wake?.(), { once: true });
      while (!signal.aborted) {
        if (pending.length) yield pending.shift();
        else await new Promise<void>((resolve) => { wake = resolve; });
      }
    } }) },
  } as unknown as Context;
  cleanup = await plugin.setup(context) ?? undefined;
});

afterEach(async () => {
  await cleanup?.();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function invoke(name: string, event: unknown): Promise<void> {
  const callback = hooks.get(name);
  if (!callback) throw new Error(`Missing hook: ${name}`);
  await callback(event as never);
}
function toolEvent(tool: string, input: unknown, sessionID = "ses_a") {
  return { tool, input, sessionID, agent: "build", messageID: "msg_1", id: `call_${tool}` };
}
async function context(sessionID = "ses_a"): Promise<SessionContext> {
  const event = { sessionID, system: [], messages: [], tools: {}, options: {} } as unknown as SessionContext;
  await invoke("session.context", event);
  return event;
}

describe("OpenCode V2 adapter", () => {
  it("registers all bundled skills with an installed script root", () => {
    expect(skills.map((skill) => skill.name).sort()).toEqual(["gcam", "gcamp", "gcampr", "git-ops", "monitor", "review", "validate"]);
    expect(skills.every((skill) => skill.id.startsWith("devloop:"))).toBe(true);
    const git = skills.find((skill) => skill.name === "git-ops")!;
    expect(git.content).not.toContain("<PLUGIN_ROOT>");
    expect(git.content).toContain("/scripts/python");
    expect(readFileSync(git.path, "utf8")).toContain("name: git-ops");
  });

  it("retains Board context in successive requests and restores it after compaction/resume", async () => {
    const first = await context();
    expect(JSON.stringify(first.system)).toContain("design.md");
    expect(JSON.stringify((await context()).system)).toContain("design.md");
    await invoke("session.prompt", { sessionID: "ses_a", messageID: "msg_2" } as SessionPrompt);
    const nextTurn = JSON.stringify((await context()).system);
    expect(nextTurn).toContain("design.md");
    expect(nextTurn).toContain("Branch: feature");
    expect(nextTurn).toContain("Validation history");
    await invoke("session.compaction", { sessionID: "ses_a" });
    expect(JSON.stringify((await context()).system)).toContain("design.md");
  });

  it.each([
    ["edit", { path: "a.ts", old: "a", new: "b" }],
    ["write", { path: "a.ts", content: "b" }],
    ["patch", { patchText: "*** Begin Patch\n*** Add File: a.ts\n+b\n*** End Patch" }],
  ])("rejects %s when another session owns the checkout", async (tool, input) => {
    acquireOwner(root, { harness: "codex", sessionId: "another" }, "feature", undefined, process.pid);
    await expect(invoke("tool.execute.before", toolEvent(tool, input))).rejects.toThrow(/owned/i);
  });

  it("keeps checkout ownership consistent with shell workflows and isolates concurrent sessions", async () => {
    await invoke("tool.execute.before", toolEvent("write", { path: "a.ts", content: "b" }));
    expect(readOwner(root)).toMatchObject({ harness: "opencode", session_id: "ses_a" });
    await expect(invoke("tool.execute.before", toolEvent("edit", { path: "a.ts" }, "ses_b"))).rejects.toThrow(/another|owned/i);
    const execute = tools.get("shell")!.execute;
    const outputs = await Promise.all(["ses_a", "ses_b"].map((sessionID) => execute({}, { sessionID } as ToolContext)));
    expect(outputs.map((output) => output.output)).toMatchObject([
      { DEVLOOP_HARNESS: "opencode", DEVLOOP_SESSION_ID: "ses_a" },
      { DEVLOOP_HARNESS: "opencode", DEVLOOP_SESSION_ID: "ses_b" },
    ]);
    const unrelated: ShellCreateBefore = { command: "true", cwd: root, timeout: 1000, shell: "sh", env: {} };
    await invoke("shell.create.before", unrelated);
    expect(unrelated.env).toEqual({});
    await cleanup?.(); cleanup = undefined;
    expect(readOwner(root)).toBeUndefined();
  });

  it("uses the session location and follows directory moves instead of the plugin location", async () => {
    const other = join(root, "other");
    execFileSync("git", ["init", "-q", "-b", "main", other]);
    await context();
    locations.set("ses_a", other);
    await expect(invoke("tool.execute.before", toolEvent("shell", { command: "git commit -m test" }))).rejects.toThrow(/protected/i);
  });

  it.each([
    [{ exit: 0 }, "succeeded"],
    [{ exit: 2 }, "failed"],
    [{ exit: 0, timeout: true }, "failed"],
    [{ signal: "SIGTERM" }, "failed"],
  ])("records structured shell results without interpreting output text", async (output, outcome) => {
    const event = toolEvent("shell", { command: "true" });
    await invoke("tool.execute.before", event);
    await invoke("tool.execute.after", { ...event, status: "completed", result: { output, content: "Exit code: 9" } });
    const rows = readFileSync(join(root, ".devloop/tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.at(-1)).toMatchObject({ phase: "finished", harness: "opencode", outcome });
    expect(rows.at(-1)).not.toHaveProperty("content");
  });

  it("records a CodeMode structured child failure", async () => {
    const event = toolEvent("execute", { code: "return await tools.shell({command: 'git commit'})" });
    await invoke("tool.execute.before", event);
    await invoke("tool.execute.after", { ...event, status: "completed", result: { output: { error: true }, content: "" } });
    const rows = readFileSync(join(root, ".devloop/tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.at(-1)).toMatchObject({ phase: "finished", tool: "execute", outcome: "failed" });
  });

  it("keeps distinct ledger identities for a CodeMode parent and its nested tools", async () => {
    const parent = { ...toolEvent("execute", { code: "..." }), id: "shared" };
    const first = { ...toolEvent("shell", { command: "true" }), id: "shared" };
    const second = { ...toolEvent("shell", { command: "false" }), id: "shared" };
    for (const event of [parent, first, second]) await invoke("tool.execute.before", event);
    for (const event of [second, first, parent]) await invoke("tool.execute.after", { ...event, status: "completed", result: { output: { exit: 0 }, content: "" } });
    const rows = readFileSync(join(root, ".devloop/tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const starts = rows.filter((row) => row.phase === "started").map((row) => row.call_id);
    expect(new Set(starts).size).toBe(3);
    expect(rows.filter((row) => row.phase === "finished").map((row) => row.call_id)).toEqual(starts.toReversed());
  });

  it("releases owners at execution end and clears state at session deletion", async () => {
    await invoke("tool.execute.before", toolEvent("write", { path: "a.ts" }));
    expect(readOwner(root)).toBeDefined();
    publish({ type: "session.execution.succeeded", data: { sessionID: "ses_a" } });
    await vi.waitFor(() => expect(readOwner(root)).toBeUndefined());
    await invoke("tool.execute.before", toolEvent("write", { path: "a.ts" }));
    publish({ type: "session.deleted", data: { sessionID: "ses_a" } });
    await vi.waitFor(() => expect(readOwner(root)).toBeUndefined());
  });

  it("does not report a background shell as a successful completed mutation", async () => {
    const event = toolEvent("shell", { command: "git switch next", background: true });
    await invoke("tool.execute.before", event);
    await invoke("tool.execute.after", { ...event, status: "completed", result: { output: { status: "running" } } });
    const rows = readFileSync(join(root, ".devloop/tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.every((row) => row.phase === "started")).toBe(true);
  });
});

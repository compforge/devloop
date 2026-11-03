import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Model, Provider } from "@opencode/plugin";
import type { Context } from "@opencode/plugin/promise/plugin";
import type { SessionPrompt } from "@opencode/plugin/promise/session";
import { setup } from "../adapters/opencode/index.js";

const ref = (id: string) => Model.Ref.parse(`openai/${id}`);
const ids = ["gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-astra"];
let cleanup: (() => void) | undefined;
let prompt: (event: SessionPrompt) => Promise<void> | void;
let selected: Map<string, Model.Ref>;
let stored: Map<string, unknown>;
let switchModel: ReturnType<typeof vi.fn>;
let request: ReturnType<typeof vi.fn<typeof fetch>>;
let models: Model.Info[];
let history: unknown[];
let context: Context;
const answer = (choice: string) => Response.json({ answers: [{ type: "choice", name: "complexity", choice, confidence: 0.95 }] });
const event = (text = "request", id = "s1", delivery = "steer") => ({ sessionID: id, messageID: `m-${text}`, prompt: { text }, delivery }) as SessionPrompt;

beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Response bodies are single-use; every fetch must exercise a fresh classification.
  request = vi.fn<typeof fetch>().mockImplementation(async () => answer("simple"));
  vi.stubGlobal("fetch", request);
  selected = new Map([["s1", ref("model-router")]]);
  stored = new Map(); history = [];
  models = ids.map((id) => Model.Info.default(Provider.ID.make("openai"), Model.ID.make(id)));
  switchModel = vi.fn(async ({ sessionID, model }) => { selected.set(sessionID, model); });
  context = {
    options: {},
    provider: { transform: async (callback: (editor: unknown) => void) => callback({
      get: () => ({ models: new Map(models.map((model) => [model.id, model])) }),
      models: { set: (_id: string, value: Model.Info[]) => { models = value; } },
    }) },
    model: { list: async () => ({ data: models }), default: async () => ({ data: ref("model-router") }) },
    session: {
      get: async ({ sessionID }: { sessionID: string }) => ({ model: selected.get(sessionID) }),
      switchModel,
      context: async () => history,
      hook: async (_name: string, handler: typeof prompt) => { prompt = handler; },
    },
    storage: { get: async (key: string) => stored.get(key), set: async (key: string, value: unknown) => { stored.set(key, value); }, remove: async (key: string) => { stored.delete(key); } },
    event: { subscribe: ({ signal }: { signal: AbortSignal }) => ({ async *[Symbol.asyncIterator]() {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    } }) },
  } as unknown as Context;
  cleanup = await setup(context);
});
afterEach(() => { cleanup?.(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("OpenCode routing ownership", () => {
  it.each([["simple", ids[0]], ["medium", ids[1]], ["complex", ids[2]]])("routes %s to %s", async (tier, target) => {
    request.mockResolvedValue(answer(tier!));
    await prompt(event());
    expect(selected.get("s1")).toEqual(ref(target!));
    expect(stored.get("route/s1")).toEqual(ref(target!));
  });
  it("Auto uses Sol's real transport model as its fallback", () => {
    expect(models.find((model) => model.id === "model-router")?.modelID).toBe("gpt-6.1-sol");
  });
  it("routes consecutive prompts and includes previous task context", async () => {
    request.mockResolvedValueOnce(answer("complex")).mockResolvedValueOnce(answer("complex"));
    await prompt(event("diagnose a distributed race"));
    history = [{ type: "user", text: "diagnose a distributed race" }];
    await prompt(event("fix"));
    expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).input).toContain("diagnose a distributed race");
    expect(switchModel).toHaveBeenCalledTimes(2);
  });
  it("leaves manually selected models alone and resumes on Auto", async () => {
    await prompt(event());
    selected.set("s1", ref("gpt-6-astra"));
    await prompt(event("manual"));
    expect(request).toHaveBeenCalledTimes(1);
    selected.set("s1", ref("model-router"));
    await prompt(event("auto"));
    expect(request).toHaveBeenCalledTimes(2);
    expect(selected.get("s1")).toEqual(ref("gpt-6.1-terra"));
    expect(console.error).toHaveBeenLastCalledWith(expect.stringContaining('"reason":"classified"'));
  });
  it("preserves a manual selection made while classification is pending", async () => {
    let finish!: (value: Response) => void;
    request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const running = prompt(event());
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    selected.set("s1", ref("gpt-6-astra"));
    finish(answer("simple")); await running;
    expect(switchModel).not.toHaveBeenCalled();
  });
  it("discards a late classification when a newer prompt owns the session", async () => {
    let finish!: (value: Response) => void;
    request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(answer("complex"));
    const first = prompt(event("first"));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await prompt(event("newer")); finish(answer("simple")); await first;
    expect(selected.get("s1")).toEqual(ref("gpt-6-astra"));
    expect(switchModel).toHaveBeenCalledTimes(1);
  });
  it("does not change the active model for queue admission", async () => {
    await prompt(event("queued", "s1", "queue"));
    expect(request).not.toHaveBeenCalled(); expect(switchModel).not.toHaveBeenCalled();
  });
  it("falls back to Sol on malformed decisions and unavailable target models", async () => {
    request.mockResolvedValueOnce(Response.json({ answers: [] })).mockResolvedValueOnce(answer("complex"));
    await prompt(event());
    expect(selected.get("s1")).toEqual(ref("gpt-6.1-sol"));
    models = models.filter((model) => model.id !== "gpt-6-astra");
    await prompt(event("next"));
    expect(selected.get("s1")).toEqual(ref("gpt-6.1-sol"));
  });
  it("recovers routing ownership after a plugin restart", async () => {
    await prompt(event()); cleanup?.(); cleanup = await setup(context);
    request.mockResolvedValue(answer("complex")); await prompt(event("next"));
    expect(selected.get("s1")).toEqual(ref("gpt-6-astra"));
  });
  it("keeps sessions independent", async () => {
    selected.set("s2", ref("model-router"));
    request.mockResolvedValueOnce(answer("complex")).mockResolvedValueOnce(answer("simple"));
    await Promise.all([prompt(event("one")), prompt(event("two", "s2"))]);
    expect(selected.get("s1")).toEqual(ref("gpt-6-astra")); expect(selected.get("s2")).toEqual(ref("gpt-6.1-terra"));
  });
});

it("keeps compaction summaries as task evidence", async () => {
  history = [{ type: "compaction", status: "completed", summary: "Unresolved multi-service deadlock" }];
  await prompt(event("continue"));
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).input).toContain("Unresolved multi-service deadlock");
});
it("does not route attachment-only or truncated tasks to Terra", async () => {
  const attached = event("inspect this");
  attached.prompt.files = [{}] as SessionPrompt["prompt"]["files"];
  await prompt(attached);
  expect(selected.get("s1")).toEqual(ref("gpt-6.1-sol"));
  expect(console.error).toHaveBeenLastCalledWith(expect.stringContaining('"reason":"conservative_floor"'));
  await prompt(event("x".repeat(30_000)));
  expect(selected.get("s1")).toEqual(ref("gpt-6.1-sol"));
  expect(console.error).toHaveBeenLastCalledWith(expect.stringContaining('"reason":"conservative_floor"'));
  expect(JSON.parse(String(request.mock.calls[1]?.[1]?.body)).input.length).toBeLessThanOrEqual(24_000);
});
it("does not switch after plugin unload", async () => {
  let finish!: (value: Response) => void;
  request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const running = prompt(event());
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  cleanup?.(); finish(answer("complex")); await running;
  expect(switchModel).not.toHaveBeenCalled();
});

it("waits for a model switch receipt before routing the next prompt", async () => {
  let release!: () => void;
  let writing = false;
  const persist = context.storage.set;
  vi.spyOn(context.storage, "set").mockImplementation(async (key, value) => {
    if (!writing) { writing = true; await new Promise<void>(resolve => { release = resolve; }); }
    await persist(key, value);
  });
  const first = prompt(event("first"));
  await vi.waitFor(() => expect(writing).toBe(true));
  request.mockResolvedValue(answer("complex"));
  const second = prompt(event("second"));
  release(); await Promise.all([first, second]);
  expect(selected.get("s1")).toEqual(ref("gpt-6-astra"));
});

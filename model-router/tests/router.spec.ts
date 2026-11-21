import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Model, Provider } from "@opencode/plugin";
import type { Context } from "@opencode/plugin/promise/plugin";
import type { SessionPrompt } from "@opencode/plugin/promise/session";
import { setup } from "../adapters/opencode/index.js";
import { fastModel } from "../domain/routing.js";

const ref = (id: string) => ({ providerID: Provider.ID.make("openai"), id: Model.ID.make(id) });
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
      get: (id: string) => ({ models: new Map(models.filter(model => model.providerID === id).map((model) => [model.id, model])) }),
      models: { set: (id: string, value: Model.Info[]) => { models = [...models.filter(model => model.providerID !== id), ...value]; } },
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
    expect(stored.get("route/s1")).toEqual({ mode: "auto", lastModel: ref(target!) });
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

describe("Auto Fast", () => {
  it("offers exactly two Auto entries and leaves original model defaults unchanged", () => {
    expect(models.filter(model => model.id.startsWith("model-router")).map(model => [model.id, model.name])).toEqual([
      ["model-router", "Auto (Decisions)"], ["model-router-fast", "Auto Fast (Decisions)"],
    ]);
    const autoFast = models.find(model => model.id === "model-router-fast")!;
    expect(autoFast.modelID).toBe(ids[1]);
    expect(autoFast.settings).toMatchObject({ serviceTier: "priority" });
    expect(autoFast.body).toMatchObject({ service_tier: "priority" });
    for (const id of ids) {
      const original = models.find(model => model.id === id)!;
      expect(original.settings?.serviceTier).toBeUndefined();
      expect(original.body?.service_tier).toBeUndefined();
    }
  });
  it.each([["simple", ids[0]], ["medium", ids[1]], ["complex", ids[2]]])("routes %s with priority service", async (tier, id) => {
    selected.set("s1", ref("model-router-fast"));
    request.mockResolvedValueOnce(answer(tier!));
    await prompt(event());
    expect(selected.get("s1")).toEqual(fastModel(ref(id!)));
    expect(stored.get("route/s1")).toEqual({ mode: "auto-fast", lastModel: fastModel(ref(id!)) });
    const variant = models.find(model => model.id === id)!.variants.find(variant => variant.id === "model-router-fast")!;
    expect(variant.settings).toEqual({ serviceTier: "priority" });
    expect(variant.body).toEqual({ service_tier: "priority" });
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).service_tier).toBeUndefined();
  });
  it("preserves Fast across prompts and restart, and switches back to ordinary Auto", async () => {
    selected.set("s1", ref("model-router-fast"));
    await prompt(event()); cleanup?.(); cleanup = await setup(context);
    request.mockResolvedValueOnce(answer("complex"));
    await prompt(event("next"));
    expect(selected.get("s1")).toEqual(fastModel(ref(ids[2]!)));
    selected.set("s1", ref("model-router"));
    await prompt(event("ordinary"));
    expect(selected.get("s1")).toEqual(ref(ids[0]!));
    expect(stored.get("route/s1")).toEqual({ mode: "auto", lastModel: ref(ids[0]!) });
  });
  it("continues legacy ownership in ordinary Auto", async () => {
    selected.set("s1", ref(ids[0]!)); stored.set("route/s1", ref(ids[0]!));
    request.mockResolvedValueOnce(answer("complex"));
    await prompt(event());
    expect(selected.get("s1")).toEqual(ref(ids[2]!));
    expect(stored.get("route/s1")).toEqual({ mode: "auto", lastModel: ref(ids[2]!) });
  });
  it("falls back to medium Fast on classifier failure or a missing target", async () => {
    selected.set("s1", ref("model-router-fast"));
    request.mockResolvedValueOnce(Response.json({ answers: [] })).mockResolvedValueOnce(answer("complex"));
    await prompt(event());
    expect(selected.get("s1")).toEqual(fastModel(ref(ids[1]!)));
    models = models.filter(model => model.id !== ids[2]);
    await prompt(event("next"));
    expect(selected.get("s1")).toEqual(fastModel(ref(ids[1]!)));
  });
  it("does not silently fall back to ordinary medium when Fast variants are unavailable", async () => {
    selected.set("s1", ref("model-router-fast"));
    models = models.map(model => ({ ...model, variants: [] }));
    await prompt(event());
    expect(switchModel).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenLastCalledWith(expect.stringContaining('"reason":"fallback_unavailable"'));
  });
  it("keeps the conservative medium floor in Fast mode", async () => {
    selected.set("s1", ref("model-router-fast"));
    const attached = event("inspect this");
    attached.prompt.files = [{}] as SessionPrompt["prompt"]["files"];
    await prompt(attached);
    expect(selected.get("s1")).toEqual(fastModel(ref(ids[1]!)));
    vi.stubEnv("OPENAI_API_KEY", "");
    await prompt(event("no key"));
    expect(selected.get("s1")).toEqual(fastModel(ref(ids[1]!)));
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not offer Auto Fast when the configured medium variant is missing", async () => {
    cleanup?.();
    models = ids.map(id => Model.Info.default(Provider.ID.make("openai"), Model.ID.make(id)));
    context = { ...context, options: { models: { medium: { ...ref(ids[1]!), variant: "missing" } } } };
    cleanup = await setup(context);
    expect(models.some(model => model.id === "model-router")).toBe(true);
    expect(models.some(model => model.id === "model-router-fast")).toBe(false);
  });
  it("registers priority variants across the configured providers", async () => {
    cleanup?.();
    models.push(Model.Info.default(Provider.ID.make("gateway"), Model.ID.make("reasoner")));
    context = { ...context, options: { models: { complex: { providerID: "gateway", id: "reasoner" } } } };
    cleanup = await setup(context);
    selected.set("s1", ref("model-router-fast"));
    request.mockResolvedValueOnce(answer("complex"));
    await prompt(event());
    expect(selected.get("s1")).toEqual({ providerID: "gateway", id: "reasoner", variant: "model-router-fast" });
    expect(models.find(model => model.providerID === "gateway")!.variants[0]!.body).toEqual({ service_tier: "priority" });
    expect(models.filter(model => model.id.startsWith("model-router"))).toHaveLength(2);
  });
  it("leaves queue admission and manual selections alone", async () => {
    selected.set("s1", ref("model-router-fast"));
    await prompt(event("queued", "s1", "queue"));
    expect(request).not.toHaveBeenCalled();
    await prompt(event());
    selected.set("s1", ref(ids[0]!));
    await prompt(event("manual"));
    expect(request).toHaveBeenCalledTimes(1);
    expect(stored.has("route/s1")).toBe(false);
  });
  it("discards a pending Fast result after switching to Auto", async () => {
    selected.set("s1", ref("model-router-fast"));
    let finish!: (value: Response) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(answer("medium"));
    const first = prompt(event("first"));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    selected.set("s1", ref("model-router"));
    await prompt(event("ordinary")); finish(answer("complex")); await first;
    expect(selected.get("s1")).toEqual(ref(ids[1]!));
    expect(switchModel).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite a manual selection while Fast classification is pending", async () => {
    selected.set("s1", ref("model-router-fast"));
    let finish!: (value: Response) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const running = prompt(event());
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    selected.set("s1", ref(ids[2]!)); finish(answer("simple")); await running;
    expect(switchModel).not.toHaveBeenCalled();
  });
  it("keeps ordinary and Fast sessions independent", async () => {
    selected.set("s2", ref("model-router-fast"));
    await Promise.all([prompt(event("ordinary")), prompt(event("fast", "s2"))]);
    expect(selected.get("s1")).toEqual(ref(ids[0]!));
    expect(selected.get("s2")).toEqual(fastModel(ref(ids[0]!)));
  });
  it("preserves configured reasoning variants and overrides conflicting service tiers", async () => {
    cleanup?.();
    models = models.map(model => ({ ...model, settings: { reasoningEffort: "medium", serviceTier: "flex", nested: { keep: true, effort: "medium" } },
      body: { service_tier: "flex", keep: true, nested: { keep: true, effort: "medium" } }, variants: [{ id: Model.VariantID.make("high"),
        settings: { reasoningEffort: "high", serviceTier: "default", nested: { effort: "high" } },
        body: { service_tier: "default", extra: true, nested: { effort: "high" } } }] }));
    context = { ...context, options: { models: { medium: { ...ref(ids[1]!), variant: "high" } } } };
    cleanup = await setup(context);
    selected.set("s1", ref("model-router-fast"));
    request.mockResolvedValueOnce(answer("medium"));
    await prompt(event());
    expect(selected.get("s1")).toEqual({ ...ref(ids[1]!), variant: "model-router-fast-high" });
    const variant = models.find(model => model.id === ids[1])!.variants.find(variant => variant.id === "model-router-fast-high")!;
    expect(variant.settings).toEqual({ reasoningEffort: "high", serviceTier: "priority", nested: { effort: "high" } });
    expect(variant.body).toEqual({ service_tier: "priority", extra: true, nested: { effort: "high" } });
    const alias = models.find(model => model.id === "model-router-fast")!;
    expect(alias.settings).toMatchObject({ reasoningEffort: "high", serviceTier: "priority", nested: { keep: true, effort: "high" } });
    expect(alias.body).toEqual({ service_tier: "priority", keep: true, extra: true, nested: { keep: true, effort: "high" } });
    expect(models.find(model => model.id === ids[1])!.settings?.serviceTier).toBe("flex");
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

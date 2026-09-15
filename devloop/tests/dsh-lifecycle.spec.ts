import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import type { Agent, PreStepDecision } from "@deepseek-ai/dsh-agent";
import { createUserMessage, type UserMessage } from "@deepseek-ai/dsh-llm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dshPlugin from "../adapters/dsh.js";
import { runGit } from "../lib/process.js";

let root: string;
let ctx: Context;
let agent: Agent;
let injected: UserMessage[];

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-dsh-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  const initialized = runGit(root, ["init", "-q", "-b", "feature"]);
  if (!initialized.ok) throw new Error(initialized.stderr);
  writeFileSync(join(root, ".gitignore"), ".devloop/\nconfig/\n");
  writeFileSync(join(root, "AGENTS.md"), "# Project\n\n## References\n\n- [Design](design.md) — Project behavior\n");
  writeFileSync(join(root, "design.md"), "# Design\n");
  injected = [];
  // Only the live Agent surface consumed by the adapter is needed here; Cordis
  // dispatch and Board projection/delivery use their real implementations.
  agent = {
    id: "dsh-session",
    session: { header: { cwd: root } },
    inject: (message: UserMessage) => { injected.push(message); },
  } as unknown as Agent;
  ctx = new Context();
  ctx.provide("agents", {});
  ctx.provide("tools", {});
  await ctx.plugin(dshPlugin).await();
});

afterEach(async () => {
  await ctx.fiber.dispose();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

function preStep(decision: PreStepDecision): Promise<PreStepDecision> {
  return ctx.waterfall("agent/pre-step", {
    agent,
    messages: decision.kind === "enter" ? decision.messages : [],
    turn: 1,
    step: 1,
    signal: new AbortController().signal,
  }, async () => decision);
}

describe("DSH lifecycle", () => {
  it.each(["startup", "resume", "clear"] as const)("seeds Board context during %s initialization", async (source) => {
    let observedDuringCreation = 0;
    ctx.on("agent/created", () => { observedDuringCreation = injected.length; });

    await ctx.serial("agent/created", { agent, source });

    expect(observedDuringCreation).toBe(1);
    expect(injected).toHaveLength(1);
    expect(injected[0]).toMatchObject({ role: "user", source: { kind: "plugin", plugin: "devloop" } });
    expect(JSON.stringify(injected[0]?.content)).toContain("design.md");
  });

  it("replays delivered references after compaction", async () => {
    await ctx.serial("agent/created", { agent, source: "startup" });
    await ctx.serial("agent/created", { agent, source: "resume" });
    expect(injected).toHaveLength(1);

    await ctx.serial("agent/created", { agent, source: "compact" });

    expect(injected).toHaveLength(2);
    expect(injected[1]?.content).toEqual(injected[0]?.content);
    expect(injected[1]?.id).not.toBe(injected[0]?.id);
  });

  it("preserves the Goal request-series boundary while appending Board context", async () => {
    const prompt = createUserMessage({ content: [{ type: "text", text: "Continue the goal" }], source: { kind: "plugin", plugin: "goal" } });
    const downstream: PreStepDecision = { kind: "enter", messages: [prompt], startsRequestSeries: true };

    const result = await preStep(downstream);

    expect(result).toMatchObject({ kind: "enter", startsRequestSeries: true });
    if (result.kind !== "enter") throw new Error("Expected an admitted step");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBe(prompt);
    expect(result.messages[1]).toMatchObject({ role: "user", source: { kind: "plugin", plugin: "devloop" } });
    expect(downstream.messages).toEqual([prompt]);
  });

  it("leaves rejected steps untouched without consuming Board delivery", async () => {
    const rejected: PreStepDecision = { kind: "reject" };
    expect(await preStep(rejected)).toBe(rejected);

    const admitted = await preStep({ kind: "enter", messages: [] });
    expect(admitted).toMatchObject({ kind: "enter", messages: [expect.objectContaining({ source: { kind: "plugin", plugin: "devloop" } })] });
  });

  it("returns the downstream decision unchanged when no Board context is due", async () => {
    await preStep({ kind: "enter", messages: [] });
    const downstream: PreStepDecision = { kind: "enter", messages: [], startsRequestSeries: true };
    expect(await preStep(downstream)).toBe(downstream);
  });
});

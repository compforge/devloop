import { Model } from "@opencode/plugin";
import type { Context, Plugin } from "@opencode/plugin/promise/plugin";
import type { Session } from "@opencode/schema/session";
import { modelRef, routeFor, sameModel, type Complexity, type ModelRef } from "../../domain/routing.js";
import { configuration } from "../../lib/config.js";
import { DecisionError, DecisionsClient } from "../../lib/decisions.js";

const AUTO_ID = "model-router";
function log(event: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ plugin: "model-router", event, ...fields }));
}

/**
 * @spec Routing is opt-in through Auto; classification never owns permissions or agent selection.
 * @spec Queued prompts do not mutate the model of work that is already running.
 * @why switchModel is session-wide; stale classifications and manual overrides must win over a late result.
 * @case ../../tests/router.spec.ts
 */
export async function setup(ctx: Context): Promise<() => void> {
  const config = configuration(ctx.options);
  const client = new DecisionsClient(config);
  const auto = { providerID: config.models.medium.providerID, id: AUTO_ID };
  const revisions = new Map<string, symbol>();
  const transitions = new Map<string, Promise<void>>();
  let closed = false;
  const controller = new AbortController();
  const storageKey = (id: string) => `route/${id}`;
  const effectiveModel = async (id: Session.ID): Promise<ModelRef | undefined> => {
    const session = await ctx.session.get({ sessionID: id });
    return session.model ?? (await ctx.model.default()).data ?? undefined;
  };

  // Auto inherits a real Sol model's transport, credentials and limits. If routing
  // is skipped (e.g. queue admission), inference still has a usable medium model.
  await ctx.provider.transform((editor) => {
    const provider = editor.get(auto.providerID);
    const medium = provider?.models.get(config.models.medium.id);
    if (!provider || !medium) return;
    editor.models.set(auto.providerID, [
      ...[...provider.models.values()].filter((model) => model.id !== AUTO_ID),
      { ...medium, id: Model.ID.make(AUTO_ID), name: "Auto (Decisions)", variants: [], enabled: true },
    ]);
  });

  await ctx.session.hook("prompt", async (event) => {
    if (closed || event.delivery === "queue") return;
    const revision = Symbol();
    revisions.set(event.sessionID, revision);
    const start = Date.now();
    try {
      await transitions.get(event.sessionID);
      const selected = await effectiveModel(event.sessionID);
      const last = modelRef(await ctx.storage.get(storageKey(event.sessionID)));
      if (!sameModel(selected, auto) && !sameModel(selected, last)) {
        if (last) await ctx.storage.remove(storageKey(event.sessionID));
        return;
      }
      const history = await ctx.session.context({ sessionID: event.sessionID });
      const previous = history.flatMap((message) => {
        if (message.type === "user") return [`User: ${message.text}`];
        if (message.type === "compaction" && message.status === "completed") return [`Summary: ${message.summary}`];
        if (message.type === "assistant") return message.content.filter((part) => part.type === "text").map((part) => `Assistant: ${part.text}`);
        return [];
      }).slice(-12).join("\n").slice(-Math.floor(config.maxInputChars / 2));
      const budget = config.maxInputChars - previous.length - 250;
      const text = event.prompt.text;
      const truncated = text.length > budget;
      const current = truncated ? `${text.slice(0, Math.floor(budget / 2))}\n[request truncated]\n${text.slice(-Math.floor(budget / 2))}` : text;
      const input = `Recent conversation (evidence):\n${previous}\n\nCurrent user request:\n${current}\nAttachment count: ${event.prompt.files?.length ?? 0}`;
      let tier: Complexity = "medium";
      let reason = "classified";
      let confidence: number | undefined;
      try {
        const classification = await client.classify(input);
        confidence = classification.confidence;
        tier = routeFor(classification, config.minimumConfidence);
        if (tier === "simple" && (truncated || event.prompt.files?.length)) tier = "medium";
        if (tier !== classification.complexity) reason = "conservative_floor";
      } catch (error) {
        reason = error instanceof DecisionError ? error.code : "classification_failed";
      }
      if (closed || revisions.get(event.sessionID) !== revision) return;
      const available = (await ctx.model.list()).data;
      const exists = (ref: ModelRef) => available.some((model) => model.enabled && model.providerID === ref.providerID && model.id === ref.id
        && (!ref.variant || model.variants.some((variant) => variant.id === ref.variant)));
      let target = config.models[tier];
      if (!exists(target)) { target = config.models.medium; reason = "target_unavailable"; }
      if (!exists(target)) { log("route_skipped", { session: event.sessionID, reason: "fallback_unavailable" }); return; }
      // Serialize only the host mutation and ownership receipt, not classification.
      // A new prompt must not observe our switched model before its receipt exists.
      const previousTransition = transitions.get(event.sessionID);
      const transition = (async () => {
        await previousTransition;
        const currentModel = await effectiveModel(event.sessionID);
        if (closed || revisions.get(event.sessionID) !== revision || !sameModel(selected, currentModel)) {
          log("route_skipped", { session: event.sessionID, reason: "selection_changed" });
          return;
        }
        await ctx.session.switchModel({ sessionID: event.sessionID, model: target });
        // Only ownership is persisted; prompt text stays in OpenCode's own history.
        await ctx.storage.set(storageKey(event.sessionID), { ...target });
        log("routed", { session: event.sessionID, message: event.messageID, tier, confidence, target, reason, durationMs: Date.now() - start });
      })();
      transitions.set(event.sessionID, transition);
      try { await transition; }
      finally { if (transitions.get(event.sessionID) === transition) transitions.delete(event.sessionID); }
    } catch {
      log("route_skipped", { session: event.sessionID, message: event.messageID, reason: "host_error", durationMs: Date.now() - start });
    } finally {
      if (revisions.get(event.sessionID) === revision) revisions.delete(event.sessionID);
    }
  });

  void (async () => {
    for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
      if (event.type !== "session.deleted") continue;
      revisions.delete(event.data.sessionID);
      try { await ctx.storage.remove(storageKey(event.data.sessionID)); }
      catch { log("cleanup_failed", { session: event.data.sessionID }); }
    }
  })().catch(() => { if (!closed) log("events_failed", {}); });
  return () => { closed = true; controller.abort(); client.close(); revisions.clear(); };
}

export default { id: "compforge.model-router", setup } satisfies Plugin;

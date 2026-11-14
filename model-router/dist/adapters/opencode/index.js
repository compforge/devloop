import { Model } from "@opencode/plugin";
import { fastModel, routingOwnership, routeFor, sameModel } from "../../domain/routing.js";
import { configuration } from "../../lib/config.js";
import { DecisionError, DecisionsClient } from "../../lib/decisions.js";
const AUTO_ID = "model-router";
const AUTO_FAST_ID = "model-router-fast";
function log(event, fields) {
    console.error(JSON.stringify({ plugin: "model-router", event, ...fields }));
}
// Match host variant semantics when materializing Auto Fast's queue fallback.
// A shallow spread would drop nested model defaults overridden only in part.
function mergeOverlay(base = {}, overlay = {}) {
    return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(overlay)])].map(key => {
        const left = base[key], right = overlay[key];
        if (right === undefined)
            return [key, left];
        if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
            return [key, mergeOverlay(left, right)];
        }
        return [key, right];
    }));
}
/**
 * @spec Routing is opt-in through Auto or Auto Fast; classification never owns permissions or agent selection.
 * @spec Auto Fast preserves the chosen reasoning settings and requests priority service, including fallback and tool steps.
 * @spec Queued prompts do not mutate the model of work that is already running.
 * @why switchModel is session-wide; stale classifications and manual overrides must win over a late result.
 * @case ../../tests/router.spec.ts
 */
export async function setup(ctx) {
    const config = configuration(ctx.options);
    const client = new DecisionsClient(config);
    const auto = { providerID: config.models.medium.providerID, id: AUTO_ID };
    const autoFast = { providerID: config.models.medium.providerID, id: AUTO_FAST_ID };
    const routes = { auto: config.models, "auto-fast": {
            simple: fastModel(config.models.simple), medium: fastModel(config.models.medium), complex: fastModel(config.models.complex),
        } };
    const revisions = new Map();
    const transitions = new Map();
    let closed = false;
    const controller = new AbortController();
    const storageKey = (id) => `route/${id}`;
    const effectiveModel = async (id) => {
        const session = await ctx.session.get({ sessionID: id });
        return session.model ?? (await ctx.model.default()).data ?? undefined;
    };
    // Variants keep the real models in the picker without global billing changes.
    // Raw body overlays win over protocol settings, so both must request priority.
    await ctx.provider.transform((editor) => {
        for (const providerID of new Set(Object.values(config.models).map(ref => ref.providerID))) {
            const source = editor.get(providerID);
            if (!source)
                continue;
            editor.models.set(providerID, [...source.models.values()].map(model => {
                const variants = Object.values(config.models).filter(ref => ref.providerID === providerID && ref.id === model.id).flatMap(ref => {
                    const base = ref.variant && ref.variant !== "default" ? model.variants.find(variant => variant.id === ref.variant) : undefined;
                    if (ref.variant && ref.variant !== "default" && !base)
                        return [];
                    return [{ ...base, id: Model.VariantID.make(fastModel(ref).variant),
                            settings: { ...base?.settings, serviceTier: "priority" },
                            body: { ...base?.body, service_tier: "priority" } }];
                });
                return { ...model, variants: [...new Map([...model.variants, ...variants].map(variant => [variant.id, variant])).values()] };
            }));
        }
        const provider = editor.get(auto.providerID);
        const medium = provider?.models.get(config.models.medium.id);
        if (!provider || !medium)
            return;
        const fast = medium.variants.find(variant => variant.id === fastModel(config.models.medium).variant);
        // Both Auto entries inherit a working medium transport even when queue
        // admission skips classification. Fast also inherits the configured variant.
        editor.models.set(auto.providerID, [
            ...[...provider.models.values()].filter((model) => model.id !== AUTO_ID && model.id !== AUTO_FAST_ID),
            { ...medium, id: Model.ID.make(AUTO_ID), name: "Auto (Decisions)", variants: [], enabled: true },
            ...(fast ? [{ ...medium, id: Model.ID.make(AUTO_FAST_ID), name: "Auto Fast (Decisions)", variants: [], enabled: true,
                    settings: mergeOverlay(medium.settings, fast.settings),
                    headers: Object.fromEntries([...Object.entries(medium.headers ?? {}), ...Object.entries(fast.headers ?? {})].map(([name, value]) => [name.toLowerCase(), value])),
                    body: mergeOverlay(medium.body, fast.body) }] : []),
        ]);
    });
    await ctx.session.hook("prompt", async (event) => {
        if (closed || event.delivery === "queue")
            return;
        const revision = Symbol();
        revisions.set(event.sessionID, revision);
        const start = Date.now();
        try {
            await transitions.get(event.sessionID);
            const selected = await effectiveModel(event.sessionID);
            const ownership = routingOwnership(await ctx.storage.get(storageKey(event.sessionID)));
            const mode = sameModel(selected, autoFast) ? "auto-fast"
                : sameModel(selected, auto) ? "auto" : sameModel(selected, ownership?.lastModel) ? ownership?.mode : undefined;
            if (!mode) {
                if (ownership)
                    await ctx.storage.remove(storageKey(event.sessionID));
                return;
            }
            const history = await ctx.session.context({ sessionID: event.sessionID });
            const previous = history.flatMap((message) => {
                if (message.type === "user")
                    return [`User: ${message.text}`];
                if (message.type === "compaction" && message.status === "completed")
                    return [`Summary: ${message.summary}`];
                if (message.type === "assistant")
                    return message.content.filter((part) => part.type === "text").map((part) => `Assistant: ${part.text}`);
                return [];
            }).slice(-12).join("\n").slice(-Math.floor(config.maxInputChars / 2));
            const budget = config.maxInputChars - previous.length - 250;
            const text = event.prompt.text;
            const truncated = text.length > budget;
            const current = truncated ? `${text.slice(0, Math.floor(budget / 2))}\n[request truncated]\n${text.slice(-Math.floor(budget / 2))}` : text;
            const input = `Recent conversation (evidence):\n${previous}\n\nCurrent user request:\n${current}\nAttachment count: ${event.prompt.files?.length ?? 0}`;
            let tier = "medium";
            let reason = "classified";
            let confidence;
            try {
                const classification = await client.classify(input);
                confidence = classification.confidence;
                tier = routeFor(classification, config.minimumConfidence);
                if (tier === "simple" && (truncated || event.prompt.files?.length))
                    tier = "medium";
                if (tier !== classification.complexity)
                    reason = "conservative_floor";
            }
            catch (error) {
                reason = error instanceof DecisionError ? error.code : "classification_failed";
            }
            if (closed || revisions.get(event.sessionID) !== revision)
                return;
            const available = (await ctx.model.list()).data;
            const exists = (ref) => available.some((model) => model.enabled && model.providerID === ref.providerID && model.id === ref.id
                && (!ref.variant || model.variants.some((variant) => variant.id === ref.variant)));
            let target = routes[mode][tier];
            if (!exists(target)) {
                target = routes[mode].medium;
                reason = "target_unavailable";
            }
            if (!exists(target)) {
                log("route_skipped", { session: event.sessionID, reason: "fallback_unavailable" });
                return;
            }
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
                await ctx.storage.set(storageKey(event.sessionID), { mode, lastModel: { ...target } });
                log("routed", { session: event.sessionID, message: event.messageID, mode, tier, confidence, target, reason, durationMs: Date.now() - start });
            })();
            transitions.set(event.sessionID, transition);
            try {
                await transition;
            }
            finally {
                if (transitions.get(event.sessionID) === transition)
                    transitions.delete(event.sessionID);
            }
        }
        catch {
            log("route_skipped", { session: event.sessionID, message: event.messageID, reason: "host_error", durationMs: Date.now() - start });
        }
        finally {
            if (revisions.get(event.sessionID) === revision)
                revisions.delete(event.sessionID);
        }
    });
    void (async () => {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
            if (event.type !== "session.deleted")
                continue;
            revisions.delete(event.data.sessionID);
            try {
                await ctx.storage.remove(storageKey(event.data.sessionID));
            }
            catch {
                log("cleanup_failed", { session: event.data.sessionID });
            }
        }
    })().catch(() => { if (!closed)
        log("events_failed", {}); });
    return () => { closed = true; controller.abort(); client.close(); revisions.clear(); };
}
export default { id: "compforge.model-router", setup };

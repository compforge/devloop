import type { Context } from "@opencode/plugin/promise/plugin";
/**
 * @spec Routing is opt-in through Auto or Auto Fast; classification never owns permissions or agent selection.
 * @spec Auto Fast preserves the chosen reasoning settings and requests priority service, including fallback and tool steps.
 * @spec Queued prompts do not mutate the model of work that is already running.
 * @why switchModel is session-wide; stale classifications and manual overrides must win over a late result.
 * @case ../../tests/router.spec.ts
 */
export declare function setup(ctx: Context): Promise<() => void>;
declare const _default: {
    id: string;
    setup: typeof setup;
};
export default _default;

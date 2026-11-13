import type { Context } from "@opencode/plugin/promise/plugin";
/**
 * @spec OpenCode request-local Board context remains visible throughout a user turn.
 * @why Context hooks are not durable history; consuming a queue cannot preserve them across requests.
 * @link ../../docs/harness-adapters.md
 * @case ../../tests/opencode.spec.ts
 */
declare function setup(ctx: Context): Promise<() => void>;
declare const _default: {
    id: string;
    setup: typeof setup;
};
export default _default;
//# sourceMappingURL=index.d.ts.map
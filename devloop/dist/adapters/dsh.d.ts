import type { Context } from "@deepseek-ai/cordis";
export declare const name = "devloop";
export declare const inject: readonly string[];
export interface Config {
    /** Fallback cwd for tool executions that have no owning agent. */
    readonly cwd?: string;
}
/** Native Cordis adapter. Domain and policy behavior remains in the shared core. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=dsh.d.ts.map
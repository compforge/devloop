import type { Decision } from "./core/domain.js";
export declare function recordDeniedDecision(root: string, decision: Decision, input: {
    readonly tool: string;
    readonly cwd: string;
    readonly branch?: string;
    readonly sessionId?: string;
}): void;
//# sourceMappingURL=friction.d.ts.map
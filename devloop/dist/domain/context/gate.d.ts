import { type PullRequestSnapshot } from "../forge.js";
export interface GateView {
    readonly branch?: string;
    readonly head: string;
    readonly target: string;
    readonly provider?: string;
    readonly activePullRequest?: PullRequestSnapshot;
    readonly protected: boolean;
    readonly inactive: boolean;
    readonly inFlight: boolean;
}
/** Resolve PR association through repocli and recheck live Git identity at decision time. */
export declare function evaluateGate(repo: string): Promise<GateView>;
//# sourceMappingURL=gate.d.ts.map
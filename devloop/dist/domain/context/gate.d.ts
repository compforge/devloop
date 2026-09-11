import { type PullRequest } from "../forge.js";
export interface GateView {
    readonly branch?: string;
    readonly head: string;
    readonly target: string;
    readonly provider?: string;
    readonly activePullRequest?: PullRequest;
    readonly protected: boolean;
    readonly inactive: boolean;
    readonly inFlight: boolean;
}
/** Read live git identity and join only a SHA-compatible cached PR. */
export declare function evaluateGate(repo: string): GateView;
//# sourceMappingURL=gate.d.ts.map
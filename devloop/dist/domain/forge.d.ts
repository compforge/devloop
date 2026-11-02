export { ForgeError, ForgeAuthError, ForgeNotFound, parsePullRequestNumber } from "@compforge/repokit";
export type { PullRequestKey, PullRequestState, PullRequestSnapshot } from "@compforge/repokit";
import type { PullRequestSnapshot, PullRequestMergeReadiness } from "@compforge/repokit";
export declare function blocksMerge(readiness: PullRequestMergeReadiness): boolean;
export declare function pullRequestInactive(pr: PullRequestSnapshot): boolean;
export declare function pullRequestOpen(pr: PullRequestSnapshot): boolean;
export declare function vocabulary(provider?: string): readonly [noun: string, sigil: string];
export declare function pullRequestLabel(provider: string | undefined, number: number): string;
//# sourceMappingURL=forge.d.ts.map
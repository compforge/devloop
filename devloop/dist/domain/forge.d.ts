export { ForgeError, ForgeAuthError, ForgeNotFound, parsePullRequestNumber } from "@compforge/repocli";
export type { PullRequestIdentity, PullRequestState, PullRequest, CommentResolution, Comment, Release, MergeReadiness, ForgePort } from "@compforge/repocli";
import { type PullRequest, type ForgePort, type MergeReadiness } from "@compforge/repocli";
export declare const PRS_CAP = 5;
export declare function blocksMerge(readiness: MergeReadiness): boolean;
export declare function pullRequestInactive(pr: PullRequest): boolean;
export declare function pullRequestOpen(pr: PullRequest): boolean;
export declare function vocabulary(provider?: string): readonly [noun: string, sigil: string];
export declare function pullRequestLabel(provider: string | undefined, number: number): string;
/** Keep the current proposal in the bounded recent window. */
export declare function buildWindow(forge: ForgePort, anchor?: number, cap?: number): Promise<readonly PullRequest[]>;
//# sourceMappingURL=forge.d.ts.map
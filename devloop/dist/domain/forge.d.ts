export declare const PRS_CAP = 5;
export declare class ForgeError extends Error {
}
export declare class ForgeAuthError extends ForgeError {
}
export declare class ForgeNotFound extends ForgeError {
}
/** Stable cross-repository identity of a review proposal. */
export interface PullRequestIdentity {
    readonly source: string;
    readonly repository: string;
    readonly number: number;
}
export type PullRequestState = "open" | "merged" | "closed" | "";
/** Provider-neutral code review proposal. */
export interface PullRequest {
    readonly number: number;
    readonly title: string;
    readonly state: PullRequestState;
    readonly sourceBranch: string;
    readonly targetBranch: string;
    readonly webUrl: string;
    readonly sha: string;
    readonly updatedAt?: string;
}
export type CommentResolution = "unsupported" | "unresolved" | "resolved";
/** Provider-neutral conversation or review thread. */
export interface Comment {
    readonly author: string;
    readonly body: string;
    readonly id: string;
    readonly path: string;
    readonly line?: number;
    readonly createdAt: string;
    readonly replies: readonly Comment[];
    readonly replyRef: string;
    readonly resolveRef: string;
    readonly resolution: CommentResolution;
}
export interface Release {
    readonly tag: string;
    readonly name: string;
    readonly target: string;
    readonly webUrl: string;
    readonly createdAt?: string;
}
export type MergeReadiness = "ready" | "conflict" | "discussions_unresolved" | "ci_blocked" | "needs_approval" | "draft" | "unknown";
export declare function blocksMerge(readiness: MergeReadiness): boolean;
export declare function pullRequestInactive(pr: PullRequest): boolean;
export declare function pullRequestOpen(pr: PullRequest): boolean;
export declare function vocabulary(provider?: string): readonly [noun: string, sigil: string];
export declare function pullRequestLabel(provider: string | undefined, number: number): string;
export declare function parsePullRequestNumber(value: string): number | undefined;
/** Forge primitives consumed by workflows; provider policy stays outside adapters. */
export interface ForgePort {
    readonly provider: "github" | "gitlab";
    create(input: {
        readonly sourceBranch: string;
        readonly targetBranch: string;
        readonly title: string;
        readonly body?: string;
    }): Promise<PullRequest>;
    get(number: number): Promise<PullRequest>;
    description(number: number): Promise<string>;
    update(number: number, fields: {
        readonly title?: string;
        readonly body?: string;
        readonly targetBranch?: string;
    }): Promise<PullRequest>;
    close(number: number): Promise<PullRequest>;
    pullRequestsForBranch(branch: string): Promise<readonly PullRequest[]>;
    recent(limit: number): Promise<readonly PullRequest[]>;
    defaultBranch(): Promise<string>;
    createRelease(input: {
        readonly tag: string;
        readonly target: string;
        readonly name?: string;
        readonly notes?: string;
    }): Promise<Release>;
    latestRelease(): Promise<Release | undefined>;
    comments(number: number): Promise<readonly Comment[]>;
    comment(number: number, body: string, options?: {
        readonly replyable?: boolean;
        readonly path?: string;
        readonly line?: number;
    }): Promise<void>;
    reply(number: number, target: Comment, body: string): Promise<void>;
    resolveComment(number: number, target: Comment): Promise<void>;
    mergeReadiness(number: number): Promise<MergeReadiness>;
}
/** Keep the current proposal in the bounded recent window. */
export declare function buildWindow(forge: ForgePort, anchor?: number, cap?: number): Promise<readonly PullRequest[]>;
//# sourceMappingURL=forge.d.ts.map
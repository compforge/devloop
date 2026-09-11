import type { ReferenceEntry } from "../../lib/parsers.js";
export declare const REPO_STALE_SECONDS = 300;
export declare const WORKSPACE_STALE_SECONDS = 600;
export declare const TURN_TTL_SECONDS = 1800;
export declare const SESSION_TTL_SECONDS = 14400;
export declare const LOCAL_PR_POLL_CONCURRENCY = 4;
export declare const REMOTE_VIEW_STALE_SECONDS = 120;
export declare const ACTIVE_REPO_TTL_SECONDS = 21600;
export declare const REVIEW_STALE_SECONDS = 1800;
export declare const DEFAULT_BRANCH_TTL_SECONDS = 86400;
export declare const REVIEW_FINDING_NUDGE_CAP = 3;
export declare const REVIEW_NUDGE_CAP = 1;
export interface Reference {
    readonly title: string;
    readonly path: string;
    readonly hook?: string;
}
export interface AgentsDocument {
    readonly path?: string;
    readonly references: readonly Reference[];
}
export declare function referenceFrom(entry: ReferenceEntry): Reference;
export interface CadenceRecord {
    last_hash?: string;
    last_emit_at?: number;
}
/** Content-addressed delivery cursor with a TTL replay backstop. */
export declare class Cadence {
    lastHash: string | undefined;
    lastEmitAt: number | undefined;
    constructor(record?: CadenceRecord);
    shouldEmit(text: string, at: number, ttl: number): boolean;
    mark(text: string, at: number): void;
    clear(): void;
    toJSON(): CadenceRecord;
}
export declare function contentHash(text: string): string;
export declare function now(): number;
export declare function stale(timestamp: number | undefined, ttl: number, at?: number): boolean;
export declare function formatTimestamp(timestamp?: number): string;
//# sourceMappingURL=base.d.ts.map
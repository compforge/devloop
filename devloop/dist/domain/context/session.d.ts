export declare const OWNER_TTL_SECONDS = 1800;
export interface SessionIdentity {
    readonly harness: "claude" | "codex" | "dsh" | "unknown";
    readonly sessionId: string;
}
export interface OwnerRecord {
    readonly harness: string;
    readonly session_id: string;
    readonly pid: number;
    readonly branch: string;
    readonly acquired_at: number;
}
export declare function identityFromEnvironment(): SessionIdentity;
export declare function readOwner(repo: string): OwnerRecord | undefined;
export declare function foreignOwner(repo: string, sessionId: string, harness?: string, at?: number): OwnerRecord | undefined;
export declare function anyActiveOwner(repo: string, at?: number): OwnerRecord | undefined;
/** First active session wins checkout ownership; I/O failure remains fail-open. */
export declare function acquireOwner(repo: string, identity: SessionIdentity, branch?: string, at?: number, pid?: number): boolean;
export declare function releaseOwner(repo: string, identity: SessionIdentity): boolean;
export declare function ownerDescription(owner: OwnerRecord): string;
export declare function repositoryName(repo: string): string;
export declare function sessionName(sessionId?: string): string;
export declare function recordActiveRepo(workspaceRoot: string, repo: string, sessionId?: string): void;
export declare function loadActiveRepo(workspaceRoot: string, sessionId?: string): string | undefined;
export declare function loadActiveRepoLenient(workspaceRoot: string, sessionId?: string): {
    readonly repo: string;
    readonly age: number;
} | undefined;
export declare function clearActiveRepo(workspaceRoot: string, sessionId?: string): void;
export declare function recordSessionEvent(repo: string, sessionId: string | undefined, kind: string, fields?: Record<string, unknown>): void;
//# sourceMappingURL=session.d.ts.map
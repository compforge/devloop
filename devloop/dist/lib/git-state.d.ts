export interface WorkspaceStatus {
    readonly dirty: boolean;
    readonly modifiedCount: number;
    readonly untrackedCount: number;
}
export interface WorktreeEntry {
    readonly path: string;
    readonly sha: string;
    readonly branch?: string;
}
export declare function currentBranch(repo: string): string | undefined;
export declare function isProtectedBranch(branch?: string): boolean;
export declare function aheadBehind(repo: string, target?: string): readonly [ahead: number, behind: number] | undefined;
export declare function workspaceStatus(repo: string): WorkspaceStatus;
export declare function revParse(repo: string, ref: string): string;
export declare function headSha(repo: string): string;
export declare function targetExists(repo: string, target?: string): boolean;
export declare function localDefaultTarget(repo: string): string;
export declare function refreshRemoteHead(repo: string, timeoutMs?: number): boolean;
export declare function setLocalDefaultHead(repo: string, branch: string): boolean;
export declare function isAncestor(repo: string, ancestor?: string, descendant?: string): boolean;
export declare function upstreamAheadBehind(repo: string): readonly [ahead: number, behind: number] | undefined;
export declare function remoteTips(repo: string, branches: readonly string[], timeoutMs?: number): ReadonlyMap<string, string>;
export declare function listWorktrees(repo: string): readonly WorktreeEntry[];
export declare function worktreeMetadata(repo: string): {
    readonly linked: boolean;
    readonly commonDir: string;
    readonly mainBranch?: string;
};
export declare function localBranches(repo: string): ReadonlyMap<string, string>;
export declare function fetchRemote(repo: string, refs?: readonly string[], timeoutMs?: number): boolean;
/** Keep runtime state local without editing the repository's committed ignore file. */
export declare function ensureGitExclude(repo: string, pattern?: string): void;
//# sourceMappingURL=git-state.d.ts.map
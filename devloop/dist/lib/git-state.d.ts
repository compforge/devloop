export { currentBranch, aheadBehind, workspaceStatus, revParse, headSha, targetExists, refreshRemoteHead, setLocalDefaultHead, isAncestor, upstreamAheadBehind, remoteTips, listWorktrees, mainRepoRoot, worktreeMetadata, localBranches, fetchRemote } from "@compforge/repocli";
export type { WorkspaceStatus, WorktreeEntry } from "@compforge/repocli";
export declare function isProtectedBranch(branch?: string): boolean;
export declare function localDefaultTarget(repo: string): string;
export declare function ensureGitExclude(repo: string, pattern?: string): void;
//# sourceMappingURL=git-state.d.ts.map
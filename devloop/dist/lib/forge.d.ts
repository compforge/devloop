import { PullRequestContext } from "@compforge/repocli";
/**
 * @spec A Forge origin without credentials is unavailable, never known to have no PR.
 * @see {@link component://docs/pr-observation.md}
 */
export declare function prContextForRepo(repo: string): Promise<PullRequestContext | undefined>;
//# sourceMappingURL=forge.d.ts.map
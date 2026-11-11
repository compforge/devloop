import { pullRequestContext, type PullRequestContext } from "@compforge/repokit";
import { pullRequestTarget } from "./config.js";

/**
 * @spec Missing credentials mean unavailable PR facts, never absence of PRs.
 * @why Branch association and ancestry verification have no equivalent repocli entry yet;
 * use the native toolkit until that operation is exposed, without duplicating access logic.
 * @see {@link component://docs/pr-observation.md}
 */
export async function prContextForRepo(repo: string): Promise<PullRequestContext | undefined> {
  const target = pullRequestTarget(repo);
  return pullRequestContext(repo, target ? { targets: [target] } : {});
}

import { loadConfig, remote } from "@compforge/repokit";
import { pullRequestTarget } from "./config.js";
/**
 * @spec Missing credentials mean unavailable PR facts, never absence of PRs.
 * @why Branch association and ancestry verification have no equivalent repocli entry yet;
 * use the native toolkit until that operation is exposed, without duplicating access logic.
 * @see {@link component://docs/pr-observation.md}
 */
export async function prContextForRepo(repo) {
    const origin = await remote(repo);
    if (!origin)
        return undefined;
    const connection = (await loadConfig()).forge(origin.host);
    const target = pullRequestTarget(repo) ?? origin.path;
    return connection.pullRequestContext(repo, { source: origin.path, targets: [target] });
}
//# sourceMappingURL=forge.js.map
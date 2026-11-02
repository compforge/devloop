import { ForgeConnection, detectProvider, remote, type PullRequestContext } from "@compforge/repokit";
import { forgeEntry, forgeToken } from "./config.js";

/**
 * @spec A Forge origin without credentials is unavailable, never known to have no PR.
 * @see {@link component://docs/pr-observation.md}
 */
export async function prContextForRepo(repo: string): Promise<PullRequestContext | undefined> {
  const origin = await remote(repo);
  if (!origin) return undefined;
  const entry = forgeEntry(origin.host, repo);
  const provider = detectProvider(origin.host, typeof entry.type === "string" ? entry.type : undefined);
  const connection = new ForgeConnection({
    host: origin.host, provider, token: forgeToken(origin.host, provider, repo) ?? "",
    ...(typeof entry.api_host === "string" && entry.api_host ? { apiHost: entry.api_host } : {}),
  });
  const target = typeof entry.target_repository === "string" && entry.target_repository ? entry.target_repository : origin.path;
  return connection.pullRequestContext(repo, { source: origin.path, targets: [target] });
}

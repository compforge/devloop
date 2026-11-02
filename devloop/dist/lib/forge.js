import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { createForgeReader, remote, PullRequestContext } from "@compforge/repokit";
import { forgeEntry, forgeToken } from "./config.js";
/**
 * @spec A Forge origin without credentials is unavailable, never known to have no PR.
 * @see {@link component://docs/pr-observation.md}
 */
export async function prContextForRepo(repo) {
    const origin = await remote(repo);
    if (!origin)
        return undefined;
    const entry = forgeEntry(origin.host, repo);
    const provider = entry.type === "github" || entry.type === "gitlab" ? entry.type
        : origin.host === "github.com" || origin.host.startsWith("github.") ? "github" : "gitlab";
    const token = forgeToken(origin.host, provider, repo);
    if (!token)
        throw new Error(`PR query unavailable: no credential for ${origin.host}/${origin.path}`);
    const forge = origin.host === "github.com" ? "github" : origin.host === "gitlab.com" ? "gitlab" : origin.host;
    const host = typeof entry.api_host === "string" && entry.api_host ? entry.api_host : origin.host;
    const source = { forge: { name: forge }, path: origin.path };
    const target = { forge: source.forge, path: typeof entry.target_repository === "string" && entry.target_repository ? entry.target_repository : source.path };
    const reader = createForgeReader({ forge, provider, host, token });
    const connection = createHash("sha256").update(JSON.stringify([provider, forge, host, token])).digest("hex");
    return new PullRequestContext(reader, { checkout: repo, source, targets: [target], stateDir: join(homedir(), ".repocli"), connection });
}
//# sourceMappingURL=forge.js.map
import { currentBranch, headSha, isAncestor, isProtectedBranch, localDefaultTarget } from "../../lib/git-state.js";
import { pullRequestInactive, pullRequestOpen } from "../forge.js";
import { loadSegment } from "./store.js";
function pullRequest(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const row = value;
    if (typeof row.number !== "number")
        return undefined;
    return {
        number: row.number,
        title: typeof row.title === "string" ? row.title : "",
        state: row.state === "open" || row.state === "merged" || row.state === "closed" ? row.state : "",
        sourceBranch: typeof row.source_branch === "string" ? row.source_branch : "",
        targetBranch: typeof row.target_branch === "string" ? row.target_branch : "",
        webUrl: typeof row.web_url === "string" ? row.web_url : "",
        sha: typeof row.sha === "string" ? row.sha : "",
        ...(typeof row.updated_at === "string" ? { updatedAt: row.updated_at } : {}),
    };
}
/** Read live git identity and join only a SHA-compatible cached PR. */
export function evaluateGate(repo) {
    const branch = currentBranch(repo);
    const head = headSha(repo);
    const target = localDefaultTarget(repo);
    const segment = loadSegment(repo, "pr") ?? {};
    const rows = Array.isArray(segment.prs) ? segment.prs : [];
    const candidates = rows.map(pullRequest).filter((pr) => pr !== undefined && pr.sourceBranch === branch);
    const activePullRequest = candidates.find(pullRequestOpen)
        ?? candidates.find((pr) => !pr.sha || isAncestor(repo, pr.sha, head));
    return {
        ...(branch ? { branch } : {}), head, target,
        ...(typeof segment.provider === "string" ? { provider: segment.provider } : {}),
        ...(activePullRequest ? { activePullRequest } : {}),
        protected: isProtectedBranch(branch),
        inactive: activePullRequest ? pullRequestInactive(activePullRequest) : false,
        inFlight: activePullRequest ? pullRequestOpen(activePullRequest) : false,
    };
}
//# sourceMappingURL=gate.js.map
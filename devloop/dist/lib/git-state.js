import { addExclude, localDefaultBranch, targetExists } from "@compforge/repokit";
export { currentBranch, aheadBehind, workspaceStatus, revParse, headSha, targetExists, refreshRemoteHead, setLocalDefaultHead, isAncestor, upstreamAheadBehind, remoteTips, listCheckouts, checkoutInfo, mainRepoRoot, localBranches, fetchRemote } from "@compforge/repokit";
const PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];
export function isProtectedBranch(branch) {
    return branch !== undefined && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}
export function localDefaultTarget(repo) {
    const branch = localDefaultBranch(repo);
    if (branch !== undefined)
        return branch;
    if (targetExists(repo, "main"))
        return "main";
    if (targetExists(repo, "master"))
        return "master";
    return "main";
}
export function ensureGitExclude(repo, pattern = "/.devloop/") {
    try {
        addExclude(repo, pattern);
    }
    catch {
        // Runtime exclusion is best-effort; guards still ignore the namespace explicitly.
    }
}
//# sourceMappingURL=git-state.js.map
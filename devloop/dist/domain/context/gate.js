import { currentBranch, headSha, isProtectedBranch, localDefaultTarget } from "../../lib/git-state.js";
import { prContextForRepo } from "../../lib/forge.js";
import { pullRequestInactive, pullRequestOpen } from "../forge.js";
/** Resolve PR association through repocli and recheck live Git identity at decision time. */
export async function evaluateGate(repo) {
    const branch = currentBranch(repo), head = headSha(repo), target = localDefaultTarget(repo);
    const context = branch ? await prContextForRepo(repo) : undefined;
    try {
        const view = branch && context ? await context.getBranch(branch) : undefined;
        if (view?.error || view?.ambiguous)
            throw new Error(view.error ?? "Multiple PRs match this branch; select a proposal explicitly");
        if (headSha(repo) !== head || currentBranch(repo) !== branch)
            throw new Error("Checkout changed during PR decision");
        const activePullRequest = view?.selected;
        return { ...(branch ? { branch } : {}), head, target,
            ...(context ? { provider: context.reader.provider } : {}), ...(activePullRequest ? { activePullRequest } : {}),
            protected: isProtectedBranch(branch), inactive: activePullRequest ? pullRequestInactive(activePullRequest) : false,
            inFlight: activePullRequest ? pullRequestOpen(activePullRequest) : false };
    }
    finally {
        context?.close();
    }
}
//# sourceMappingURL=gate.js.map
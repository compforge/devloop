import { prContextForRepo } from "../../lib/forge.js";
import { aheadBehind, currentBranch, isProtectedBranch, localDefaultTarget, workspaceStatus, checkoutInfo } from "../../lib/git-state.js";
import { findAgentsDocument, inspectCatalog } from "../repo-layout.js";
import { InspectionError } from "../../lib/repokit.js";
import { parseReferencesSection } from "../../lib/parsers.js";
import { branchSegment, loadSegment, segmentFile } from "../context/store.js";
import { REVIEW_STALE_SECONDS, now } from "../context/base.js";
import { renderFact } from "./render.js";
import { validationHistory } from "./validation.js";
/**
 * @spec Producers assign branch-aware IDs; Board never interprets them or infers deletion.
 * @spec Board only projects facts with an authoritative reader; legacy validation stamps are not evidence.
 * @see {@link component://docs/repository-toolkit.md}
 */
export async function projectNotes(root, workspace, repo, staleBindingHours) {
    const notes = [], startupIds = [], restoreIds = [];
    const result = { notes, startupIds, restoreIds };
    const add = (type, scope, owner, payload) => {
        const id = JSON.stringify([type, ...owner]);
        notes.push({ id, scope, content: renderFact(type, payload) });
        if (type === "workspace" || type === "repo.references")
            startupIds.push(id);
        if (type !== "repo.review")
            restoreIds.push(id);
    };
    if (workspace && (workspace.agentsDocument.references.length > 0 || workspace.subprojects.length > 0)) {
        add("workspace", "workspace", [root], {
            root: workspace.workspaceRoot,
            references: workspace.agentsDocument.references.map((item) => ({ title: item.title, path: item.path, description: item.hook ?? "" })),
            subprojects: workspace.subprojects.map((item) => ({
                name: item.name, aliases: item.aliases, language: item.language ?? "", role: item.role ?? "", canonical: item.canonical ?? "",
            })),
        });
    }
    if (!repo)
        return result;
    let branch;
    try {
        branch = currentBranch(repo) ?? "";
    }
    catch { /* Unknown branch is not detached HEAD. */ }
    let component, inspectionProblem = "";
    try {
        const catalog = await inspectCatalog(repo);
        if (catalog.components.length > 0)
            component = catalog.default();
    }
    catch (error) {
        if (!(error instanceof InspectionError))
            throw error;
        inspectionProblem = error.message;
    }
    const agents = findAgentsDocument(repo, component?.path);
    const references = agents ? parseReferencesSection(agents) : [];
    if (references.length > 0) {
        add("repo.references", component ? "component" : "repo", [repo, agents ?? repo, branch ?? "@unknown"], {
            references: references.map((item) => ({ title: item.title, path: item.path, description: item.description })),
        });
    }
    // Display each unavailable observation independently; never turn a failed read into 0/0.
    let base = "?";
    try {
        base = localDefaultTarget(repo);
    }
    catch { /* Default target stays unknown. */ }
    let divergence;
    try {
        if (base !== "?")
            divergence = aheadBehind(repo, base);
    }
    catch { /* Counts stay unknown. */ }
    const [ahead, behind] = divergence ?? [null, null];
    const status = workspaceStatus(repo);
    const codeDir = component?.path ?? "";
    let linkedWorktree;
    try {
        linkedWorktree = checkoutInfo(repo).linked;
    }
    catch {
        linkedWorktree = null;
    }
    add("repo.identity", "repo", [repo], {
        codeDir, repoRoot: repo, language: component?.language ?? "", inspectionProblem, branch,
        linkedWorktree, ahead, behind, baseBranch: base,
        targetBranch: base, workspaceDirty: status.complete ? status.dirty : null, modifiedCount: status.modifiedCount,
        untrackedCount: status.untrackedCount, protected: isProtectedBranch(branch),
        ...(staleBindingHours === undefined ? {} : { staleBindingHours: Math.floor(staleBindingHours * 10) / 10 }),
    });
    // An unavailable identity cannot select detached-HEAD or another branch's persisted state.
    add("repo.validation", "repo", [repo], await validationHistory(repo));
    if (branch === undefined)
        return result;
    let prContext;
    try {
        prContext = branch ? await prContextForRepo(repo) : undefined;
        if (prContext) {
            // @why Prompt display has a short wait budget; repocli still owns cache and refresh policy.
            const view = await prContext.getCheckout({ signal: AbortSignal.timeout(1_000) });
            if (view?.selected || view?.error || view?.ambiguous)
                add("repo.pull-request", "branch", [repo, branch], {
                    branch: view.branch, provider: prContext.reader.provider,
                    ...(view.selected ? { repository: view.selected.repository.path, number: view.selected.number, state: view.selected.state, url: view.selected.url } : {}),
                    ...(view.error ? { error: view.error } : {}), ambiguous: view.ambiguous,
                });
        }
    }
    catch (error) {
        add("repo.pull-request", "branch", [repo, branch], { branch, error: String(error) });
    }
    finally {
        prContext?.close();
    }
    const reviewSegment = branchSegment(branch || undefined, "review");
    const review = loadSegment(repo, reviewSegment);
    if (review && typeof review.status === "string" && review.status && review.status !== "skipped"
        && typeof review.reviewed_sha === "string" && review.reviewed_sha) {
        const generatedAt = typeof review.generated_at === "number" ? review.generated_at : 0;
        const reviewStatus = review.status === "running" && now() - generatedAt > REVIEW_STALE_SECONDS ? "stale" : review.status;
        // Review identity includes its branch; switching views cannot overwrite another branch
        // or turn absence from this projection into deletion of its saved Note.
        add("repo.review", "branch", [repo, branch], {
            status: reviewStatus, reviewedSha: review.reviewed_sha,
            findings: typeof review.count === "number" ? review.count : 0,
            failedFiles: typeof review.failed === "number" ? review.failed : 0,
            message: typeof review.message === "string" ? review.message : "",
            artifactPath: segmentFile(repo, reviewSegment),
        });
    }
    return result;
}
//# sourceMappingURL=projection.js.map
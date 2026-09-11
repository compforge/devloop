import { aheadBehind, currentBranch, isProtectedBranch, localDefaultTarget, workspaceStatus, worktreeMetadata } from "../../lib/git-state.js";
import { findAgentsDocument, findRepoCodeDirectory } from "../repo-layout.js";
import { detectLanguage } from "../../lib/ecosystem.js";
import { parseReferencesSection } from "../../lib/parsers.js";
import { branchSegment, loadSegment } from "../context/store.js";
import { Board, boardItem } from "./model.js";
export function projectBoard(root, workspace, repo, staleBindingHours) {
    const items = [];
    if (workspace && (workspace.agentsDocument.references.length > 0 || workspace.subprojects.length > 0)) {
        items.push(boardItem("workspace", "state", { workspaceRoot: root }, {
            root: workspace.workspaceRoot,
            references: workspace.agentsDocument.references.map((item) => ({ title: item.title, path: item.path, description: item.hook ?? "" })),
            subprojects: workspace.subprojects.map((item) => ({
                name: item.name, aliases: item.aliases, language: item.language ?? "", role: item.role ?? "", canonical: item.canonical ?? "",
            })),
        }));
    }
    if (!repo)
        return new Board(root, items);
    const scope = { workspaceRoot: root, repoRoot: repo };
    const agents = findAgentsDocument(repo, findRepoCodeDirectory(repo));
    const references = agents ? parseReferencesSection(agents) : [];
    if (references.length > 0) {
        items.push(boardItem("repo.references", "state", scope, {
            references: references.map((item) => ({ title: item.title, path: item.path, description: item.description })),
        }));
    }
    const branch = currentBranch(repo) ?? "";
    const base = localDefaultTarget(repo);
    const [ahead, behind] = aheadBehind(repo, base) ?? [0, 0];
    const status = workspaceStatus(repo);
    const codeDir = findRepoCodeDirectory(repo) ?? repo;
    items.push(boardItem("repo.identity", "state", scope, {
        codeDir, language: detectLanguage(codeDir) ?? "", branch,
        linkedWorktree: worktreeMetadata(repo).linked, ahead, behind, baseBranch: base,
        targetBranch: base, workspaceDirty: status.dirty, modifiedCount: status.modifiedCount,
        untrackedCount: status.untrackedCount, protected: isProtectedBranch(branch),
        ...(staleBindingHours === undefined ? {} : { staleBindingHours }),
    }));
    const lint = loadSegment(repo, branchSegment(branch || undefined, "lint")) ?? {};
    const test = loadSegment(repo, branchSegment(branch || undefined, "test")) ?? {};
    const componentIds = [...new Set([...Object.keys(lint), ...Object.keys(test)])].sort();
    items.push(boardItem("repo.validation", "state", scope, {
        components: componentIds.map((component) => ({
            component,
            lintAt: typeof lint[component] === "object" && lint[component] !== null && !Array.isArray(lint[component]) ? lint[component].passed_at ?? null : null,
            testAt: typeof test[component] === "object" && test[component] !== null && !Array.isArray(test[component]) ? test[component].passed_at ?? null : null,
        })),
    }));
    return new Board(root, items);
}
//# sourceMappingURL=projection.js.map
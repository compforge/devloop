import { renderPrompt } from "./render.js";
import { findGitRoot } from "../repo-layout.js";
import { findContainingWorkspace } from "../workspace.js";
import { loadActiveRepo, loadActiveRepoLenient, recordSessionEvent } from "../context/session.js";
import { WorkspaceContext } from "../context/workspace.js";
import { itemsFor, PromptDelivery } from "./delivery.js";
import { projectBoard } from "./projection.js";
export class BoardRuntime {
    root;
    sessionId;
    board;
    repo;
    focus;
    constructor(root, sessionId, board, view, repo) {
        this.root = root;
        this.sessionId = sessionId;
        this.board = board;
        this.repo = repo;
        this.focus = view.focus;
    }
    get view() { return this.board.full(this.focus); }
    static async resolve(cwd, sessionId) {
        let workspaceRoot = findContainingWorkspace(cwd);
        let repo = findGitRoot(cwd);
        let staleHours;
        if (!workspaceRoot && repo)
            workspaceRoot = findContainingWorkspace(repo);
        const workspace = workspaceRoot ? WorkspaceContext.load(workspaceRoot) : undefined;
        if (!repo && workspaceRoot) {
            repo = loadActiveRepo(workspaceRoot, sessionId);
            if (!repo) {
                const lenient = loadActiveRepoLenient(workspaceRoot, sessionId);
                repo = lenient?.repo;
                staleHours = lenient ? lenient.age / 3_600 : undefined;
            }
        }
        const root = workspaceRoot ?? repo;
        if (!root)
            return undefined;
        const board = await projectBoard(root, workspace, repo, staleHours);
        return new BoardRuntime(root, sessionId, board, board.full({ workspaceRoot: root, ...(repo ? { repoRoot: repo } : {}) }), repo);
    }
    delta(trigger = "user_prompt") { return new PromptDelivery(this.root, this.sessionId).delta(this.view, trigger); }
    full() { return this.view; }
    deliverPrompt(trigger = "user_prompt") {
        const delta = this.delta(trigger);
        const result = delta.items.length ? renderPrompt(delta.items) || undefined : undefined;
        if (result) {
            if (this.repo)
                recordSessionEvent(this.repo, this.sessionId, "inject", { text: result });
            delta.acknowledge();
        }
        return result;
    }
    snapshot() { return this.view.select(itemsFor(this.view, "ui")).toJSON(); }
    afterCompact() { new PromptDelivery(this.root, this.sessionId).afterCompact(); }
    close() { new PromptDelivery(this.root, this.sessionId).clear(); }
}
//# sourceMappingURL=runtime.js.map
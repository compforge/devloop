import { findGitRoot } from "../repo-layout.js";
import { findContainingWorkspace } from "../workspace.js";
import { loadActiveRepo, loadActiveRepoLenient, recordSessionEvent, identityFromEnvironment } from "../context/session.js";
import { WorkspaceContext } from "../context/workspace.js";
import { projectNotes } from "./projection.js";
import { BoardStore } from "./store.js";
/** Harness facade: producers select relevant IDs; the Board only merges and consumes notes. */
export class BoardRuntime {
    root;
    session;
    workspace;
    repo;
    staleHours;
    store;
    constructor(root, session, workspace, repo, staleHours) {
        this.root = root;
        this.session = session;
        this.workspace = workspace;
        this.repo = repo;
        this.staleHours = staleHours;
        this.store = new BoardStore(session);
    }
    static async resolve(cwd, sessionId, harness = "claude") {
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
        return root ? new BoardRuntime(root, { harness, sessionId: sessionId || identityFromEnvironment().sessionId || "anon" }, workspace, repo, staleHours) : undefined;
    }
    async read(mode, trigger) {
        // Project under the same lock as the update: concurrent hooks cannot commit older observations last.
        return this.store.transaction(mode, async (board) => {
            const projection = await projectNotes(this.root, this.workspace, this.repo, this.staleHours);
            for (const note of projection.notes)
                board.upsert(note);
            const ids = trigger === "session_start" ? projection.startupIds : projection.notes.map(note => note.id);
            return mode === "text" ? board.text(ids) : board.delta(ids);
        });
    }
    text() { return this.read("text", "user_prompt"); }
    delta(trigger = "user_prompt") { return this.read("delta", trigger); }
    async deliverPrompt(trigger = "user_prompt") {
        const text = await this.delta(trigger);
        if (text && this.repo)
            recordSessionEvent(this.repo, this.session.sessionId, "inject", { text });
        return text || undefined;
    }
    async afterCompact() {
        await this.store.transaction("compact", async (board) => {
            const projection = await projectNotes(this.root, this.workspace, this.repo, this.staleHours);
            const restore = new Set(projection.restoreIds);
            for (const note of projection.notes) {
                // A compacted context needs one latest state, not intermediate state updates. Review queues survive.
                if (restore.has(note.id))
                    board.remove(note.id);
                board.upsert(note);
            }
        });
    }
    close() { return this.store.clear(); }
}
//# sourceMappingURL=runtime.js.map
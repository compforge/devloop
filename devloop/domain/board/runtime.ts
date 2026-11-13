import { findGitRoot } from "../repo-layout.js";
import { findContainingWorkspace } from "../workspace.js";
import { loadActiveRepo, loadActiveRepoLenient, recordSessionEvent, identityFromEnvironment } from "../context/session.js";
import { WorkspaceContext } from "../context/workspace.js";
import { projectNotes } from "./projection.js";
import { BoardStore, type BoardSession } from "./store.js";

export type PromptTrigger = "session_start" | "user_prompt";

/** Harness facade: producers select relevant IDs; the Board only merges and consumes notes. */
export class BoardRuntime {
  readonly store: BoardStore;
  constructor(readonly root: string, readonly session: BoardSession, readonly workspace?: WorkspaceContext,
    readonly repo?: string, readonly staleHours?: number) { this.store = new BoardStore(session); }

  static async resolve(cwd: string, sessionId?: string, harness = "claude"): Promise<BoardRuntime | undefined> {
    let workspaceRoot = findContainingWorkspace(cwd);
    let repo = findGitRoot(cwd);
    let staleHours: number | undefined;
    if (!workspaceRoot && repo) workspaceRoot = findContainingWorkspace(repo);
    const workspace = workspaceRoot ? WorkspaceContext.load(workspaceRoot) : undefined;
    if (!repo && workspaceRoot) {
      repo = loadActiveRepo(workspaceRoot, sessionId);
      if (!repo) {
        const lenient = loadActiveRepoLenient(workspaceRoot, sessionId);
        repo = lenient?.repo; staleHours = lenient ? lenient.age / 3_600 : undefined;
      }
    }
    const root = workspaceRoot ?? repo;
    return root ? new BoardRuntime(root, {harness, sessionId:sessionId || identityFromEnvironment().sessionId || "anon"}, workspace, repo, staleHours) : undefined;
  }

  private async read(mode: "text" | "delta", trigger: PromptTrigger): Promise<string> {
    // Project under the same lock as the update: concurrent hooks cannot commit older observations last.
    return this.store.transaction(mode, async board => {
      const projection = await projectNotes(this.root, this.workspace, this.repo, this.staleHours);
      for (const note of projection.notes) board.upsert(note);
      const ids = trigger === "session_start" ? projection.startupIds : projection.notes.map(note => note.id);
      return mode === "text" ? board.text(ids) : board.delta(ids);
    });
  }
  text(): Promise<string> { return this.read("text", "user_prompt"); }
  delta(trigger: PromptTrigger = "user_prompt"): Promise<string> { return this.read("delta", trigger); }
  async deliverPrompt(trigger: PromptTrigger = "user_prompt"): Promise<string | undefined> {
    const text = await this.delta(trigger);
    if (text && this.repo) recordSessionEvent(this.repo, this.session.sessionId, "inject", {text});
    return text || undefined;
  }
  async afterCompact(): Promise<void> {
    await this.store.transaction("compact", async board => {
      const projection = await projectNotes(this.root, this.workspace, this.repo, this.staleHours);
      const restore = new Set(projection.restoreIds);
      for (const note of projection.notes) {
        // A compacted context needs one latest state, not intermediate state updates. Review queues survive.
        if (restore.has(note.id)) board.remove(note.id);
        board.upsert(note);
      }
    });
  }
  close(): Promise<void> { return this.store.clear(); }
}

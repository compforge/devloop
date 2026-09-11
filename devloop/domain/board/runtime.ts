import { findGitRoot } from "../repo-layout.js";
import { findContainingWorkspace } from "../workspace.js";
import { loadActiveRepo, loadActiveRepoLenient, recordSessionEvent } from "../context/session.js";
import { WorkspaceContext } from "../context/workspace.js";
import { itemsFor, PromptDelivery, type PromptTrigger } from "./delivery.js";
import { projectBoard } from "./projection.js";
import type { Board, BoardView } from "./model.js";

export class BoardRuntime {
  constructor(readonly root: string, readonly sessionId: string | undefined, readonly board: Board, readonly view: BoardView, readonly repo?: string) {}
  static resolve(cwd: string, sessionId?: string): BoardRuntime | undefined {
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
    if (!root) return undefined;
    const board = projectBoard(root, workspace, repo, staleHours);
    return new BoardRuntime(root, sessionId, board, board.view({ workspaceRoot: root, ...(repo ? { repoRoot: repo } : {}) }), repo);
  }
  deliverPrompt(trigger: PromptTrigger = "user_prompt"): string | undefined {
    const result = new PromptDelivery(this.root, this.sessionId).deliver(this.view, trigger);
    if (result && this.repo) recordSessionEvent(this.repo, this.sessionId, "inject", { text: result });
    return result;
  }
  snapshot(): Record<string, unknown> { return this.view.select(itemsFor(this.view, "ui")).toJSON(); }
  afterCompact(): void { new PromptDelivery(this.root, this.sessionId).afterCompact(); }
  close(): void { new PromptDelivery(this.root, this.sessionId).clear(); }
}

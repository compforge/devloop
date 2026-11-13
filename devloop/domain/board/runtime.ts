import { renderPrompt } from "./render.js";
import { findGitRoot } from "../repo-layout.js";
import { findContainingWorkspace } from "../workspace.js";
import { loadActiveRepo, loadActiveRepoLenient, recordSessionEvent } from "../context/session.js";
import { WorkspaceContext } from "../context/workspace.js";
import { itemsFor, PromptDelivery, type BoardDelta, type PromptTrigger } from "./delivery.js";
import { projectBoard } from "./projection.js";
import type { Board, BoardFocus, BoardView } from "./model.js";

export class BoardRuntime {
  private readonly focus: BoardFocus | undefined;
  constructor(readonly root: string, readonly sessionId: string | undefined, readonly board: Board, view: BoardView, readonly repo?: string) { this.focus = view.focus; }
  get view(): BoardView { return this.board.full(this.focus); }
  static async resolve(cwd: string, sessionId?: string): Promise<BoardRuntime | undefined> {
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
    const board = await projectBoard(root, workspace, repo, staleHours);
    return new BoardRuntime(root, sessionId, board, board.full({ workspaceRoot: root, ...(repo ? { repoRoot: repo } : {}) }), repo);
  }
  delta(trigger: PromptTrigger = "user_prompt"): BoardDelta { return new PromptDelivery(this.root, this.sessionId).delta(this.view, trigger); }
  full(): BoardView { return this.view; }
  deliverPrompt(trigger: PromptTrigger = "user_prompt"): string | undefined {
    const delta = this.delta(trigger);
    const result = delta.items.length ? renderPrompt(delta.items) || undefined : undefined;
    if (result) {
      if (this.repo) recordSessionEvent(this.repo, this.sessionId, "inject", {text:result});
      delta.acknowledge();
    }
    return result;
  }
  snapshot(): Record<string, unknown> { return this.view.select(itemsFor(this.view, "ui")).toJSON(); }
  afterCompact(): void { new PromptDelivery(this.root, this.sessionId).afterCompact(); }
  close(): void { new PromptDelivery(this.root, this.sessionId).clear(); }
}

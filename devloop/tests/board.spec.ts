import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptDelivery } from "../domain/board/delivery.js";
import { Board, boardItem } from "../domain/board/model.js";
import { BoardRuntime } from "../domain/board/runtime.js";
import { renderPrompt } from "../domain/board/render.js";

const roots: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of roots.splice(0)) rmSync(root, { recursive:true, force:true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "devloop-board-")); roots.push(root);
  const scope = {workspaceRoot:root, repoRoot:root};
  const identity = (branch="feature") => boardItem("repo.identity", "state", scope, {repoRoot:root,branch});
  const board = new Board(root,[boardItem("workspace","state",{workspaceRoot:root},{root}),identity(),boardItem("repo.review","event",scope,{status:"success",reviewedSha:"abc",findings:1})]);
  return {root,scope,board,identity,delivery:new PromptDelivery(root,"session")};
}

describe("Board delta", () => {
  // @case Only acknowledged changes consume delivery; full reads and elapsed TTL do not.
  it("keeps full reads independent and delivers each revision once", () => {
    const {board,identity,delivery} = fixture();
    const first = delivery.delta(board.full());
    expect(first.items).toHaveLength(3);
    expect(delivery.delta(board.full()).items).toEqual(first.items);
    expect(board.full().items).toHaveLength(3);
    first.acknowledge();
    first.acknowledge();
    vi.useFakeTimers(); vi.advanceTimersByTime(24*60*60*1_000);
    expect(delivery.delta(board.full()).items).toEqual([]);
    board.append(identity("other"));
    expect(board.full().items).toHaveLength(3);
    const next = delivery.delta(board.full());
    expect(next.items.map(item=>item.type)).toEqual(["repo.identity"]);
    expect(next.items[0]?.payload.branch).toBe("other");
    next.acknowledge();
    expect(delivery.delta(board.full()).items).toEqual([]);
  });

  it("exposes appended producer facts through both runtime read methods", () => {
    const {root,board,identity}=fixture();
    const runtime=new BoardRuntime(root,"session",board,board.full());
    runtime.delta().acknowledge();
    board.append(identity("updated"));
    expect(runtime.full().items.find(item=>item.type==="repo.identity")?.payload.branch).toBe("updated");
    expect(runtime.delta().items.map(item=>item.payload.branch)).toEqual(["updated"]);
  });

  it("replays state after compaction while retaining consumed events", () => {
    const {board,delivery}=fixture();
    delivery.delta(board.full()).acknowledge();
    delivery.afterCompact();
    const replay=delivery.delta(board.full());
    expect(replay.items.map(item=>item.type)).toEqual(["workspace","repo.identity"]);
    replay.acknowledge();
    expect(delivery.delta(board.full()).items).toEqual([]);
  });

  it("reports removal once without treating out-of-focus facts as deleted", () => {
    const {root,scope,board,delivery}=fixture();
    delivery.delta(board.full({workspaceRoot:root,repoRoot:root})).acknowledge();
    const other=join(root,"other");
    board.append(boardItem("repo.identity","state",{workspaceRoot:root,repoRoot:other},{branch:"other"}));
    const switchDelta=delivery.delta(board.full({workspaceRoot:root,repoRoot:other}));
    expect(switchDelta.items.some(item=>item.payload.removed)).toBe(false);
    switchDelta.acknowledge();
    const back=delivery.delta(board.full(scope));
    expect(back.items.some(item=>item.type==="repo.identity")).toBe(true);
    expect(back.items.some(item=>item.type==="repo.review")).toBe(false);
    back.acknowledge();
    const removed=new Board(root,board.items.filter(item=>item.type!=="repo.review"));
    const delta=delivery.delta(removed.full(scope));
    expect(delta.items.map(item=>[item.type,item.payload.removed])).toEqual([["repo.review",true]]);
    expect(renderPrompt(delta.items)).toContain("Previous information for this item no longer applies");
    delta.acknowledge();
    expect(delivery.delta(removed.full(scope)).items).toEqual([]);
  });

  it("detects removals when the view includes all repositories", () => {
    const {root,board,delivery}=fixture();
    delivery.delta(board.full()).acknowledge();
    const next=new Board(root,board.items.filter(item=>item.type!=="repo.review"));
    expect(delivery.delta(next.full()).items.map(item=>item.payload.removed)).toEqual([true]);
  });

  it("does not consume turn items during session startup", () => {
    const {board,delivery}=fixture();
    expect(delivery.deliver(board.full(),"session_start")).toContain("[Workspace:");
    const turn=delivery.delta(board.full());
    expect(turn.items.map(item=>item.type)).toEqual(["repo.identity","repo.review"]);
  });
});

it("does not render an unavailable workspace as clean", () => {
  const item=boardItem("repo.identity","state",{workspaceRoot:"/repo",repoRoot:"/repo"},{codeDir:"/repo",branch:"feature",workspaceDirty:null});
  expect(renderPrompt([item])).toContain("Workspace: unknown");
  expect(renderPrompt([item])).not.toContain("Workspace: clean");
});

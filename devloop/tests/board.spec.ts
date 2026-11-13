import { describe, expect, it } from "vitest";
import { Board, textOf, type MergeableText, type NoteUpdate } from "../domain/board/model.js";

class Lines implements MergeableText {
  constructor(readonly value: string) {}
  merge(previous: MergeableText | string): MergeableText {
    return new Lines([...new Set([...textOf(previous).split("\n"), ...this.value.split("\n")])].join("\n"));
  }
  text(): string { return this.value; }
}
const update = (content: NoteUpdate["content"], id = "opaque-id"): NoteUpdate => ({id, scope:"branch", content});

describe("Board notes", () => {
  // @case A full read never consumes two pending updates; each update is delivered once in arrival order.
  it("merges full text and queues effective incoming updates", () => {
    const board = new Board();
    const first = new Lines("alpha"), second = new Lines("beta");
    board.upsert(update(first));
    board.upsert(update(second));
    expect(board.text()).toBe("alpha\nbeta");
    expect(board.text()).toBe("alpha\nbeta");
    expect(first.text()).toBe("alpha");
    expect(second.text()).toBe("beta");
    expect(board.delta()).toBe("alpha\n\nbeta");
    expect(board.delta()).toBe("");
    expect(board.text()).toBe("alpha\nbeta");
    board.upsert(update(second));
    expect(board.delta()).toBe("");
  });
  it("treats strings as replacement updates and preserves changes back to an earlier value", () => {
    const board = new Board();
    board.upsert(update("a"));
    board.delta();
    for (const value of ["b", "b", "a"]) board.upsert(update(value));
    expect(board.text()).toBe("a");
    expect(board.delta()).toBe("b\n\na");
  });
  it("groups by scope without emitting IDs, scope labels or a containment tree", () => {
    const board = new Board();
    for (const scope of ["branch", "repo", "component", "workspace"] as const) {
      board.upsert({id:`private-id-${scope}`, scope, content:`${scope}-content`});
    }
    expect(board.text()).toBe("workspace-content\n\nrepo-content\n\ncomponent-content\n\nbranch-content");
    expect(board.delta()).toBe(board.text());
    expect(board.text()).not.toContain("private-id");
  });
  it("keeps unselected queues and removes notes only by explicit ID", () => {
    const board = new Board();
    board.upsert(update("A", "a"));
    board.upsert(update("B", "b"));
    expect(board.delta(["a"])).toBe("A");
    expect(board.delta(["a"])).toBe("");
    expect(board.text(["b"])).toBe("B");
    expect(board.delta(["b"])).toBe("B");
    board.upsert(update("discard", "a"));
    board.remove("a"); board.remove("a");
    expect(board.text()).toBe("B");
    expect(board.delta()).toBe("");
  });
  it("restores string full/queues and accepts the next object merge without a codec", () => {
    const board = new Board();
    board.upsert(update(new Lines("one")));
    const saved = JSON.parse(JSON.stringify(board.snapshot()));
    expect(saved.notes["opaque-id"]).toEqual({scope:"branch", full:"one", queue:["one"]});
    const restored = Board.restore(saved);
    restored.upsert(update(new Lines("two")));
    expect(restored.text()).toBe("one\ntwo");
    expect(restored.delta()).toBe("one\n\ntwo");
  });
  it("does not consume any note if rendering fails", () => {
    const board = new Board(); let fail = false;
    const content: MergeableText = {merge:() => content, text:() => {if (fail) throw new Error("render failed"); return "B";}};
    board.upsert(update("A", "a")); board.upsert(update(content, "b"));
    fail = true;
    expect(() => board.delta()).toThrow("render failed");
    fail = false;
    expect(board.delta()).toBe("A\n\nB");
  });
  it("consumes only the captured prefixes when rendering appends another update", () => {
    const board = new Board(); let append = false;
    const content: MergeableText = {merge:() => content, text:() => {
      if (append) { append = false; board.upsert(update("third")); }
      return "first";
    }};
    board.upsert(update(content)); board.upsert(update("second"));
    append = true;
    expect(board.delta()).toBe("first\n\nsecond");
    expect(board.delta()).toBe("third");
    expect(board.text()).toBe("third");
  });
  it("rejects corrupt snapshots and changing the scope of an existing identity", () => {
    expect(() => Board.restore({schemaVersion:2, notes:{}})).toThrow("Invalid Board snapshot");
    expect(() => Board.restore({schemaVersion:1, notes:{a:{scope:"branch", full:"a", queue:[1]}}})).toThrow("Invalid Board note");
    const board = new Board(); board.upsert(update("A"));
    expect(() => board.upsert({...update("B"), scope:"repo"})).toThrow("scope changed");
    expect(board.text()).toBe("A");
  });
});

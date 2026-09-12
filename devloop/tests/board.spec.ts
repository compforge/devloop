import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PromptDelivery } from "../domain/board/delivery.js";
import { Board, boardItem } from "../domain/board/model.js";
import { renderPrompt } from "../domain/board/render.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Board delivery", () => {
  it("describes absent validation records as history, not an execution instruction", () => {
    const item = boardItem("repo.validation", "state", { workspaceRoot: "/repo", repoRoot: "/repo" }, { components: [] });
    expect(renderPrompt([item])).toBe("Validation history: no recorded runs");
  });

  it("keeps session and turn cadence outside fact projection", () => {
    const root = mkdtempSync(join(tmpdir(), "devloop-board-")); roots.push(root);
    const items = [
      boardItem("workspace", "state", { workspaceRoot: root }, { root, references: [], subprojects: [{ name: "api" }] }),
      boardItem("repo.identity", "state", { workspaceRoot: root, repoRoot: root }, {
        codeDir: root, language: "typescript", branch: "feature", ahead: 1, behind: 0,
        baseBranch: "main", targetBranch: "main", workspaceDirty: false,
      }),
    ];
    const view = new Board(root, items).view({ workspaceRoot: root, repoRoot: root });
    const delivery = new PromptDelivery(root, "session");
    expect(delivery.deliver(view, "session_start")).toContain("[Workspace:");
    expect(delivery.deliver(view, "user_prompt")).toContain("[Current repo:");
    expect(delivery.deliver(view, "user_prompt")).toBeUndefined();
    delivery.afterCompact();
    expect(delivery.deliver(view, "session_start")).toContain("[Workspace:");
  });
});

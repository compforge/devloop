import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterCompact, userPromptOutput } from "../adapters/process-hooks.js";
import { BoardRuntime } from "../domain/board/runtime.js";
import { REVIEW_STALE_SECONDS, now } from "../domain/context/base.js";
import { branchSegment, saveSegment, segmentFile } from "../domain/context/store.js";
import type { JsonObject } from "../lib/config.js";

let root: string;
const sha = "abc123456789";
function record(fields: JsonObject, branch = "feature"): void {
  saveSegment(root, branchSegment(branch, "review"), {
    reviewed_sha: sha, count: 0, failed: 0, generated_at: now(), ...fields,
  });
}
function runtime(): BoardRuntime {
  const board = BoardRuntime.resolve(root, "review-session");
  expect(board).toBeDefined();
  return board!;
}
function prompt(): string {
  return JSON.stringify(userPromptOutput({ cwd: root, session_id: "review-session" }));
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-board-review-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("Review state through the TypeScript Board", () => {
  // case:review-state-to-prompt Test the actual state source and hook, not an invented Board item.
  it.each([
    ["running", 0, 0, "running"],
    ["error", 0, 0, "review errored"],
    ["failed", 0, 0, "review errored"],
    ["completed_with_errors", 0, 0, "review incomplete"],
    ["completed_with_errors", 1, 2, "2 file(s) failed"],
    ["completed_with_warnings", 0, 0, "review warnings"],
    ["success", 0, 0, "clean (no findings)"],
    ["success", 2, 0, "2 finding(s)"],
  ])("delivers %s (%i findings, %i failures)", (status, count, failed, expected) => {
    record({ status, count, failed });
    const board = runtime();
    const item = board.view.items.find((item) => item.type === "repo.review");
    expect(item?.payload).toMatchObject({ status, reviewedSha: sha, findings: count, failedFiles: failed });
    expect(JSON.stringify(board.snapshot())).toContain('"repo.review"');
    const output = prompt();
    expect(output).toContain("Review:");
    expect(output).toContain(expected);
    expect(output).toContain(sha.slice(0, 9));
    expect(output).toContain(segmentFile(root, branchSegment("feature", "review")));
    if (status !== "success") expect(output).not.toContain("clean (no findings)");
  });

  it("reports a stale run using the existing timeout", () => {
    record({ status: "running", generated_at: now() - REVIEW_STALE_SECONDS - 1 });
    expect(prompt()).toContain("Review: stale");
  });

  it("includes the failure reason and does not call unknown statuses clean", () => {
    record({ status: "error", message: "review runner not found: /plugin/scripts/run_review.py" });
    expect(prompt()).toContain("review runner not found");
    record({ status: "interrupted" });
    expect(prompt()).toContain("review interrupted");
  });

  it("does not project absent, skipped, or unidentified runs", () => {
    expect(prompt()).not.toContain("Review:");
    record({ status: "skipped" });
    expect(prompt()).not.toContain("Review:");
    record({ status: "error", reviewed_sha: "" });
    expect(prompt()).not.toContain("Review:");
  });

  it("only delivers the focused branch review", () => {
    record({ status: "error" }, "other");
    expect(prompt()).not.toContain("Review:");
    execFileSync("git", ["-C", root, "symbolic-ref", "HEAD", "refs/heads/other"]);
    expect(prompt()).toContain("review errored");
  });

  // case:review-result-delivery A status transition reopens delivery; compaction does not.
  it("delivers changes once without replaying events after compaction", () => {
    record({ status: "running" });
    expect(runtime().deliverPrompt("session_start") ?? "").not.toContain("Review:");
    expect(prompt()).toContain("Review: running");
    expect(prompt()).not.toContain("Review:");
    record({ status: "error", message: "review runner not found" });
    expect(prompt()).toContain("review errored");
    expect(prompt()).not.toContain("Review:");
    afterCompact({ cwd: root, session_id: "review-session" });
    expect(prompt()).not.toContain("Review:");
    record({ status: "success", count: 1 });
    expect(prompt()).toContain("1 finding(s)");
    expect(prompt()).not.toContain("Review:");
  });
});

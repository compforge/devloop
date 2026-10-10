import { saveSegment, branchSegment } from "../domain/context/store.js";
import { projectBoard } from "../domain/board/projection.js";
import { evaluateTool } from "../hooks/core/policy.js";
import { renderItem } from "../domain/board/render.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as toolkit from "@compforge/repocli";
import { Component, inspectCatalog, findGitRoot } from "../domain/repo-layout.js";
import { selectComponents } from "../domain/repo.js";
import { PolicyContext } from "../hooks/core/context.js";
import { evaluate } from "../hooks/core/engine.js";
import { InspectionError } from "../lib/repocli.js";
import { endSession } from "../adapters/process-hooks.js";
import { acquireOwner, anyActiveOwner } from "../domain/context/session.js";
import type { Rule } from "../hooks/core/rule.js";

vi.mock("@compforge/repocli", { spy: true });

const roots: string[] = [];
afterEach(() => { vi.mocked(toolkit.inspect).mockClear(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-inspect-"))); roots.push(root);
  execFileSync("git", ["init", "-q", root]);
  mkdirSync(join(root, "service"));
  writeFileSync(join(root, "service/go.mod"), "module example.com/service\n");
  writeFileSync(join(root, "Makefile"), "lint test:\n\t@true\n");
  mkdirSync(join(root, "client"));
  writeFileSync(join(root, "client/Makefile"), "lint test:\n\t@true\n");
  // Native inspection must not depend on a usable repocli executable.
  vi.stubEnv("DEVLOOP_REPOCLI", join(root, "missing-cli"));
  return { root };
}

describe("native repocli organization", () => {
  it("renders missing and failed divergence as unknown", async () => {
    const { root } = fixture();
    let board = await projectBoard(root, undefined, root);
    let identity = board.items.find(item => item.type === "repo.identity")!;
    expect(identity.payload).toMatchObject({ ahead: null, behind: null });
    expect(renderItem(identity)).toContain("ahead ?, behind ?");
    vi.mocked(toolkit.aheadBehind).mockImplementationOnce(() => { throw new Error("read failed"); });
    board = await projectBoard(root, undefined, root);
    identity = board.items.find(item => item.type === "repo.identity")!;
    expect(renderItem(identity)).toContain("ahead ?, behind ?");
  });

  it("does not join detached branch history when identity is unavailable", async () => {
    const { root } = fixture();
    saveSegment(root, branchSegment(undefined, "review"), { status: "success", reviewed_sha: "old-head" });
    vi.mocked(toolkit.currentBranch).mockImplementationOnce(() => { throw new Error("read failed"); });
    const board = await projectBoard(root, undefined, root);
    expect(board.items.some(item => item.type === "repo.review" || item.type === "repo.validation")).toBe(false);
    expect(renderItem(board.items.find(item => item.type === "repo.identity")!)).toContain("Branch: ?");
  });

  it("denies writes when live branch identity cannot be observed", async () => {
    const { root } = fixture();
    vi.mocked(toolkit.currentBranch).mockImplementationOnce(() => { throw new Error("read failed"); });
    const result = await evaluateTool({ harness: "codex", toolName: "exec_command", toolInput: { cmd: "git commit -m example", workdir: root }, cwd: root });
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "protect-branch", severity: "deny" }));
  });

  it("uses discovered roots and metadata for moved, deleted and fixture paths without a CLI", async () => {
    const { root } = fixture();
    mkdirSync(join(root, "service/testdata/corpus"), { recursive: true });
    writeFileSync(join(root, "service/testdata/corpus/go.mod"), "module corpus");
    const catalog = await inspectCatalog(root);
    expect(selectComponents(root, { paths: ["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog }).components.map((c) => c.id)).toEqual(["service", "client"]);
    expect(catalog.owner(join(root, "service/deleted.go"))).toMatchObject({ id: "service", name: "service", language: "go", packageTools: [{ name: "go", evidence: ["service/go.mod"] }] });
    expect(catalog.owner(join(root, "service2/other.go"))?.id).toBe(".");
    expect(catalog.owner(join(root, "../outside"))).toBeUndefined();
  });

  it("shares in-flight work and failures within an operation, then refreshes", async () => {
    const { root } = fixture();
    const calls = vi.mocked(toolkit.inspect);
    const identity = { sessionId: "test", harness: "codex" } as const;
    const context = new PolicyContext(root, identity);
    const first = context.catalog(root);
    const sibling = context.forTarget({ kind: "file_change", path: join(root, "a.go"), mode: "edit" }).catalog(root);
    expect(sibling).toBe(first);
    await Promise.all([first, sibling]);
    expect(calls).toHaveBeenCalledTimes(1);
    symlinkSync("Makefile", join(root, "package.json"));
    expect(context.catalog(root)).toBe(first);
    const failed = new PolicyContext(root, identity);
    const rejection = failed.catalog(root);
    await expect(rejection).rejects.toThrow(InspectionError);
    rmSync(join(root, "package.json"));
    expect(failed.catalog(root)).toBe(rejection);
    await expect(failed.catalog(root)).rejects.toThrow(InspectionError);
    expect((await new PolicyContext(root, identity).catalog(root)).components).toHaveLength(3);
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it("retains execution containment for roots below external symlinks", async () => {
    const { root } = fixture();
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "devloop-outside-"))); roots.push(outside);
    symlinkSync(outside, join(root, "linked"));
    const report = await toolkit.inspect({ repository: root });
    vi.mocked(toolkit.inspect).mockResolvedValueOnce({ ...report, components: [{ ...report.components[0]!, root: "linked/missing" }] });
    await expect(inspectCatalog(root)).rejects.toThrow("component root escapes checkout");
  });

  it("does not use a partial observation as a complete catalog", async () => {
    const { root } = fixture();
    const report = await toolkit.inspect({ repository: root });
    vi.mocked(toolkit.inspect).mockResolvedValueOnce({ ...report, complete: false, diagnostics: [{ code: "changed", message: "input changed" }] });
    await expect(inspectCatalog(root)).rejects.toThrow("inspection incomplete");
  });

  it("releases session ownership without starting inspection", () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "cleanup", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    expect(anyActiveOwner(root)).toBeDefined();
    endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
    expect(toolkit.inspect).not.toHaveBeenCalled();
  });

  it("releases known owners when checkout enumeration fails", () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "cleanup-failure", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    vi.mocked(toolkit.listCheckouts).mockImplementationOnce(() => { throw new Error("read failed"); });
    endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
  });

  it("excludes separate metadata from session owner cleanup", () => {
    const { root } = fixture();
    const metadata = root + "-metadata"; roots.push(metadata);
    execFileSync("git", ["-C", root, "init", "--separate-git-dir", metadata]);
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "separate-cleanup", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    expect(acquireOwner(metadata, identity, "sentinel")).toBe(true);
    endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
    expect(anyActiveOwner(metadata)).toBeDefined();
  });

  it("denies a gate with missing organization and warns for optional policies", async () => {
    const { root } = fixture(); symlinkSync("Makefile", join(root, "package.json"));
    const context = new PolicyContext(root, { sessionId: "test", harness: "codex" });
    const change = { cwd: root, tool: "edit", command: "", targets: [{ kind: "file_change" as const, path: join(root, "a.go"), mode: "edit" as const }] };
    const rule: Rule = { name: "inspection", targetKind: "file_change", applies: () => true, check: async (_target, ctx) => { await ctx.catalog(root); return []; } };
    expect((await evaluate(change, context, [rule])).action).toBe("warn");
    expect((await evaluate(change, context, [{ ...rule, failurePolicy: "fail_closed" }])).action).toBe("deny");
  });
});


describe("repository contract consumption", () => {
  it("accepts a repository without markers and skips Component validation", async () => {
    const { root } = fixture();
    rmSync(join(root, "Makefile"));
    rmSync(join(root, "service/go.mod"));
    rmSync(join(root, "client/Makefile"));
    const catalog = await inspectCatalog(root);
    expect(catalog.components).toEqual([]);
    expect(selectComponents(root, { catalog })).toMatchObject({ components: [], reason: expect.stringContaining("no recognized Components") });
    const board = await projectBoard(root, undefined, root);
    expect(board.items.find(item => item.type === "repo.identity")!.payload).toMatchObject({ inspectionProblem: "" });
    expect(catalog.owner(join(root, "service/go.mod"))).toBeUndefined();
  });

  it("runs Makefile-only targets without language inference", async () => {
    const { root } = fixture();
    const catalog = await inspectCatalog(root);
    const child = catalog.owner(join(root, "client/task.py"))!;
    expect(child.language).toBeUndefined();
    expect(child.lintTarget()).toBe("lint");
    expect(child.testCommand()).toEqual(["make", "test"]);
    expect(selectComponents(root, { catalog, paths: ["client/task.py"] }).components.map(c => c.id)).toEqual(["client"]);
  });

  it("detects literal multiple and continued target headers without executing make", () => {
    const { root } = fixture();
    const component = Component.at(root, root);
    writeFileSync(join(root, "Makefile"), "# lint:\nlint := value\nrecipe:\n\ttest: false\n");
    expect(component.hasTarget("lint")).toBe(false);
    expect(component.hasTarget("test")).toBe(false);
    writeFileSync(join(root, "Makefile"), "$(error must not execute)\nfix lint \\\n test:\n\t@true\nlint-ci::\n\t@true\n");
    expect(component.hasTarget("fix")).toBe(true);
    expect(component.testTarget()).toBe("test");
    expect(component.lintTarget()).toBe("lint-ci");
  });

  it("preserves locator failures for hard guards", async () => {
    const { root } = fixture();
    vi.mocked(toolkit.findCheckout).mockImplementationOnce(() => { throw new Error("discovery failed"); });
    expect(() => findGitRoot(root)).toThrow("discovery failed");
    vi.mocked(toolkit.findCheckout).mockImplementationOnce(() => { throw new Error("discovery failed"); });
    const result = await evaluateTool({ harness: "codex", toolName: "exec_command", toolInput: { cmd: "git commit -m example", workdir: root }, cwd: root });
    expect(result.findings).toContainEqual(expect.objectContaining({ severity: "deny" }));
  });
});

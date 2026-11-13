import { saveSegment, branchSegment } from "../domain/context/store.js";
import { projectNotes } from "../domain/board/projection.js";
import { evaluateTool } from "../hooks/core/policy.js";
import { textOf } from "../domain/board/model.js";
import { BoardStore } from "../domain/board/store.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as toolkit from "@compforge/repokit";
import { inspectCatalog, findGitRoot } from "../domain/repo-layout.js";
import { PolicyContext } from "../hooks/core/context.js";
import { evaluate } from "../hooks/core/engine.js";
import { InspectionError } from "../lib/repokit.js";
import { endSession } from "../adapters/process-hooks.js";
import { acquireOwner, anyActiveOwner } from "../domain/context/session.js";
import type { Rule } from "../hooks/core/rule.js";

vi.mock("@compforge/repokit", { spy: true });

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
    let board = await projectNotes(root, undefined, root);
    let identity = board.notes.find(note => note.id.startsWith('["repo.identity",'))!;
    expect(identity.scope).toBe("repo");
    expect(textOf(identity.content)).toContain("ahead ?, behind ?");
    vi.mocked(toolkit.aheadBehind).mockImplementationOnce(() => { throw new Error("read failed"); });
    board = await projectNotes(root, undefined, root);
    identity = board.notes.find(note => note.id.startsWith('["repo.identity",'))!;
    expect(textOf(identity.content)).toContain("ahead ?, behind ?");
  });

  it("does not join detached branch history when identity is unavailable", async () => {
    const { root } = fixture();
    saveSegment(root, branchSegment(undefined, "review"), { status: "success", reviewed_sha: "old-head" });
    vi.mocked(toolkit.currentBranch).mockImplementationOnce(() => { throw new Error("read failed"); });
    const board = await projectNotes(root, undefined, root);
    expect(board.notes.some(note => note.id.startsWith('["repo.review",'))).toBe(false);
    expect(textOf(board.notes.find(note => note.id.startsWith('["repo.identity",'))!.content)).toContain("Branch: ?");
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
    writeFileSync(join(root, "client/package.json"), "{}");
    const catalog = await inspectCatalog(root);
    expect(catalog.owner(join(root, "service/deleted.go"))).toMatchObject({ id: "service", name: "service", language: "go", tools: [{ name: "go" }], toolEvidence: { go: ["service/go.mod"] } });
    expect(catalog.owner(join(root, "client/new.ts"))?.depot).toEqual({ bins: [{ path: "client/node_modules", kind: "dependencies" }] });
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

  it("releases session ownership without starting inspection", async () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "cleanup", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    expect(anyActiveOwner(root)).toBeDefined();
    await endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
    expect(toolkit.inspect).not.toHaveBeenCalled();
  });

  it("releases known owners when checkout enumeration fails", async () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "cleanup-failure", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    vi.mocked(toolkit.listCheckouts).mockImplementationOnce(() => { throw new Error("read failed"); });
    await endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
  });

  it("clears the session Board even when cwd discovery fails", async () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const session = { sessionId: "cleanup-board", harness: "codex" } as const;
    const store = new BoardStore(session);
    await store.transaction("upsert", board => board.upsert({id:"x", scope:"repo", content:"pending"}));
    vi.mocked(toolkit.findCheckout).mockImplementationOnce(() => { throw new Error("cwd unavailable"); });
    await expect(endSession({cwd:root, session_id:session.sessionId}, session.harness)).rejects.toThrow("cwd unavailable");
    expect(existsSync(store.path)).toBe(false);
  });

  it("excludes separate metadata from session owner cleanup", async () => {
    const { root } = fixture();
    const metadata = root + "-metadata"; roots.push(metadata);
    execFileSync("git", ["-C", root, "init", "--separate-git-dir", metadata]);
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "separate-cleanup", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    expect(acquireOwner(metadata, identity, "sentinel")).toBe(true);
    await endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
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
  it("accepts a repository without Component markers", async () => {
    const { root } = fixture();
    rmSync(join(root, "Makefile"));
    rmSync(join(root, "service/go.mod"));
    rmSync(join(root, "client/Makefile"));
    const catalog = await inspectCatalog(root);
    expect(catalog.components).toEqual([]);
    const board = await projectNotes(root, undefined, root);
    expect(textOf(board.notes.find(note => note.id.startsWith('["repo.identity",'))!.content)).not.toContain("inspection");
    expect(catalog.owner(join(root, "service/go.mod"))).toBeUndefined();
  });

  it("discovers Makefile-only Components without language inference", async () => {
    const { root } = fixture();
    const catalog = await inspectCatalog(root);
    const child = catalog.owner(join(root, "client/task.py"))!;
    expect(child.language).toBeUndefined();
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

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userPromptOutput } from "../adapters/process-hooks.js";
import { branchSegment, loadSegment, saveSegment } from "../domain/context/store.js";
import { snapshot } from "@compforge/repokit";
import * as repokit from "@compforge/repokit";
import { validationHistory } from "../domain/board/validation.js";
import { boardItem } from "../domain/board/model.js";
import { renderItem } from "../domain/board/render.js";

vi.mock("@compforge/repokit", async importOriginal => ({
  ...await importOriginal<typeof import("@compforge/repokit")>(),
}));

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-validation-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  vi.stubEnv("REPOKIT_HOME", join(root, "repokit-home"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

// @case Legacy passing evidence and scope must not become current Board validation facts.
it.each([false, true])("does not infer validation history from legacy records (present=%s)", async (present) => {
  const checkedAt = "2026-01-01T00:00:00Z";
  const segment = "validation_results/" + createHash("sha256").update(`${root}\0.\0lint`).digest("hex");
  const record = { eligible: true, checked_at: checkedAt, report: {
    schemaVersion: 2, inputsConsistent: true, checkout: root, snapshot: "legacy-snapshot",
    components: [{ component: { root: "." }, checks: [{ check: "lint", scope: "full", status: "passed", checkedAt }] }],
  } };
  if (present) {
    saveSegment(root, segment, record);
    saveSegment(root, branchSegment("feature", "lint"), { ".": { evidence: segment, checked_at: checkedAt } });
    saveSegment(root, branchSegment("feature", "validation_scope"), {
      checks: [{ component: "server", check: "test", scope: "full", reason: "obsolete fallback" }],
    });
  }
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "validation-session" }));
  expect(output).toContain("[Current repo:");
  expect(output).toContain("Validation history: no retained runs");
  expect(output).not.toMatch(/validation scope|obsolete fallback|legacy-snapshot/);
  expect(loadSegment(root, segment)).toEqual(present ? record : undefined);
});

// @case Current source comparison is independent of historical check status and never grants a current pass.
it("projects native history and invalidates the source comparison after an edit", async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "devloop-history-home-")));
  const installed = realpathSync(mkdtempSync(join(tmpdir(), "devloop-history-installed-")));
  vi.stubEnv("REPOKIT_HOME", home);
  try {
    execFileSync("git", ["-C",root,"remote","add","origin","https://github.com/example/board.git"]);
    writeFileSync(join(root,"source.ts"),"export const value = 1;\n");
    const observed=await snapshot(root);
    const directory=join(home,"repositories","github--example--board");
    for (const child of ["history","inputs","logs"]) mkdirSync(join(directory,child),{recursive:true});
    const check={runID:"RUN",check:"test",scope:"full",status:"passed",durationSeconds:1};
    const start={schemaVersion:2,type:"started",checkout:root,at:"2026-11-12T00:00:00Z",run:"RUN",component:".",inputs:"INPUT",check};
    const end={...start,type:"finished",at:"2026-11-12T00:00:01Z",inputsConsistent:true};
    const wal=join(directory,"history","00000000000000000001");
    writeFileSync(wal,[start,end].map((e,i)=>JSON.stringify({index:String(i+1),data:"+"+JSON.stringify(e)})+"\n").join(""));
    writeFileSync(join(directory,"inputs","INPUT.json"),JSON.stringify({schemaVersion:1,checkout:root,snapshot:observed.digest,files:{}}));
    for (const stream of ["stdout","stderr"]) writeFileSync(join(directory,"logs",`2026-11-12.${stream}.jsonl`),JSON.stringify({runID:"RUN",output:""})+"\n");
    const render=async()=>renderItem(boardItem("repo.validation","state",{workspaceRoot:root,repoRoot:root},await validationHistory(root)));
    expect(await render()).toContain("source unchanged");
    writeFileSync(join(root,"source.ts"),"export const value = 2;\n");
    const changed=await render();
    expect(changed).toContain("source changed since this run");
    expect(changed).toContain("historical results, not current validation");
    expect(changed).toContain("test: passed");
    // @case Marketplace artifacts must not borrow the source checkout's native dependencies.
    const entry = join(installed, "runtime.mjs");
    copyFileSync(fileURLToPath(new URL("../dist/hooks/runtime.js", import.meta.url)), entry);
    const runInstalled = (session: string) => execFileSync(process.execPath, [entry], {
      input: JSON.stringify({hook_event_name:"UserPromptSubmit",cwd:root,session_id:session}),
      cwd: installed, env: {...process.env, DEVLOOP_HARNESS:"codex", NODE_PATH:""}, encoding:"utf8", timeout:10_000,
    });
    expect(runInstalled("missing-native-dependency")).toContain("Cannot find module 'fs-ext'");
    const native = dirname(createRequire(import.meta.url).resolve("fs-ext"));
    cpSync(native, join(installed, "node_modules", "fs-ext"), {recursive:true});
    const bundle = runInstalled("history-bundle");
    expect(bundle).toContain("source changed since this run");
    expect(bundle).not.toContain("Validation history unavailable");
    // @case Comparison or detail failures preserve retained summaries with explicitly unknown evidence.
    const comparison = vi.spyOn(repokit, "snapshot").mockRejectedValue(new Error("comparison timed out"));
    const comparisonUnavailable = await render();
    expect(comparisonUnavailable).toContain("test: passed");
    expect(comparisonUnavailable).toContain("source comparison unavailable");
    expect(comparisonUnavailable).not.toContain("Validation history unavailable");
    comparison.mockRestore();
    const details = vi.spyOn(repokit, "readValidationRun").mockRejectedValue(new Error("detail timed out"));
    expect(await validationHistory(root)).toMatchObject({total: 1, runs: [{runID: "RUN", sourceState: "unknown", evidenceComplete: false}]});
    details.mockRestore();
    writeFileSync(wal,"broken\n");
    const unavailable=await render();
    expect(unavailable).toContain("Validation history unavailable");
    expect(unavailable).not.toContain("no retained runs");
  } finally {rmSync(home,{recursive:true,force:true});rmSync(installed,{recursive:true,force:true});}
});

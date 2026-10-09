import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutInfo, remote } from "@compforge/repocli";
import { appendLedger, temporaryDirectory } from "./context/store.js";

const TASK = "pr-lifecycle-reconcile";

function running(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

/** @why A detached one-shot task is independent of the hook's admission/Board runtime.
 * The shared claim covers its whole process lifetime, including uv startup, so slow
 * Forge sweeps cannot pile up when several sessions keep emitting tool events.
 */
export function triggerReconciliation(repo: string): boolean {
  let control = repo;
  let claim: string | undefined;
  let claimed = false;
  let log: number | undefined;
  try {
    const info = checkoutInfo(repo);
    control = info.mainRoot ?? info.root;
    if (!remote(control)) return false;
    const plugin = process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT
      ?? fileURLToPath(new URL("../../", import.meta.url));
    const catalog = JSON.parse(readFileSync(join(plugin, "tasks/tasks.json"), "utf8")) as
      { name: string; interval_seconds: number }[];
    const task = catalog.find((entry) => entry.name === TASK);
    if (!task) throw new Error(`missing task definition: ${TASK}`);
    const runner = join(plugin, "scripts/run_task.py");
    const launcher = join(plugin, "scripts/python");
    if (!existsSync(runner) || !existsSync(launcher)) throw new Error(`missing task entrypoint: ${runner}`);
    const home = temporaryDirectory(control);
    mkdirSync(home, { recursive: true });
    const stamp = join(home, `${TASK}.opportunistic`);
    if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < task.interval_seconds * 1_000) return false;
    claim = join(home, `${TASK}.claim`);
    if (existsSync(claim)) {
      try {
        const pid = Number(readFileSync(claim, "utf8"));
        if (Number.isInteger(pid) && pid > 0 && running(pid)) return false;
        // A concurrent creator has not written its PID yet; abandoned empty claims expire.
        if ((!Number.isInteger(pid) || pid <= 0) && Date.now() - statSync(claim).mtimeMs < 60_000) return false;
        unlinkSync(claim);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    let fd: number;
    try { fd = openSync(claim, "wx", 0o600); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return false; throw error; }
    claimed = true;
    try { writeFileSync(fd, String(process.pid)); } finally { closeSync(fd); }
    // Re-check after claiming: another hook may have started a task while we read the stamp.
    if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < task.interval_seconds * 1_000) {
      unlinkSync(claim); claimed = false; return false;
    }
    // One bounded latest-run log; stdout includes the report, stderr retains startup failures.
    log = openSync(join(home, `${TASK}.log`), "w", 0o600);
    const child = spawn(launcher, [runner, "run", TASK, control, "--repo-only", "--report"], {
      cwd: control, detached: true, stdio: ["ignore", log, log],
    });
    child.on("error", (error) => {
      appendLedger(control, "tasks", { task: TASK, event: "launch_failed", error: error.message, ts: Date.now() / 1_000 });
    });
    if (!child.pid) throw new Error(`could not launch ${TASK}`);
    writeFileSync(claim, String(child.pid));
    writeFileSync(stamp, "");
    appendLedger(control, "tasks", { task: TASK, event: "started", pid: child.pid, ts: Date.now() / 1_000 });
    child.unref();
    claimed = false; // The next trigger reclaims this file only after the child exits.
    return true;
  } catch (error) {
    appendLedger(control, "tasks", { task: TASK, event: "launch_failed", error: error instanceof Error ? error.message : String(error), ts: Date.now() / 1_000 });
    return false;
  } finally {
    if (log !== undefined) closeSync(log);
    if (claimed && claim) { try { unlinkSync(claim); } catch { /* Already reclaimed. */ } }
  }
}

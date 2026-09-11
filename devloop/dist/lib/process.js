import { spawnSync } from "node:child_process";
/** Run a command without a shell so arguments cannot be reinterpreted. */
export function runCommand(command, args, options = {}) {
    const spawnOptions = {
        cwd: options.cwd,
        env: options.env,
        input: options.input,
        timeout: options.timeoutMs ?? 5_000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
    };
    const result = spawnSync(command, [...args], spawnOptions);
    const code = result.status ?? -1;
    return {
        code,
        stdout: (result.stdout ?? "").trim(),
        stderr: (result.stderr ?? result.error?.message ?? "").trim(),
        ok: code === 0,
    };
}
/** Run git through the one process seam used by domain and workflow code. */
export function runGit(repo, args, timeoutMs = 5_000) {
    return runCommand("git", ["-C", repo, ...args], { timeoutMs });
}
//# sourceMappingURL=process.js.map
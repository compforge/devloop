import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";

/** Result of one bounded external command. */
export interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly ok: boolean;
}

export interface RunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly input?: string;
  readonly timeoutMs?: number;
}

/** Run a command without a shell so arguments cannot be reinterpreted. */
export function runCommand(command: string, args: readonly string[], options: RunOptions = {}): CommandResult {
  const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
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
export function runGit(repo: string, args: readonly string[], timeoutMs = 5_000): CommandResult {
  return runCommand("git", ["-C", repo, ...args], { timeoutMs });
}

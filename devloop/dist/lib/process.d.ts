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
export declare function runCommand(command: string, args: readonly string[], options?: RunOptions): CommandResult;
/** Run git through the one process seam used by domain and workflow code. */
export declare function runGit(repo: string, args: readonly string[], timeoutMs?: number): CommandResult;
//# sourceMappingURL=process.d.ts.map
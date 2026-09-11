import type { Change, FileChangeTarget } from "./domain.js";
export interface HarnessToolInput {
    readonly toolName: string;
    readonly toolInput: Record<string, unknown>;
    readonly cwd: string;
    readonly harness: "claude" | "codex" | "dsh";
}
export declare function patchFileChanges(value: unknown): readonly FileChangeTarget[];
/** Map each harness payload into the same policy Change. */
export declare function projectTool(input: HarnessToolInput): Change;
//# sourceMappingURL=project.d.ts.map
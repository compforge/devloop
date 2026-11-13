import type { WorkspaceContext } from "../context/workspace.js";
import type { NoteUpdate } from "./model.js";
export interface NoteProjection {
    readonly notes: readonly NoteUpdate[];
    readonly startupIds: readonly string[];
    readonly restoreIds: readonly string[];
}
/**
 * @spec Producers assign branch-aware IDs; Board never interprets them or infers deletion.
 * @spec Board only projects facts with an authoritative reader; legacy validation stamps are not evidence.
 * @see {@link component://docs/repository-toolkit.md}
 */
export declare function projectNotes(root: string, workspace?: WorkspaceContext, repo?: string, staleBindingHours?: number): Promise<NoteProjection>;
//# sourceMappingURL=projection.d.ts.map
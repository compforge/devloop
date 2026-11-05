import type { WorkspaceContext } from "../context/workspace.js";
import { Board } from "./model.js";
/**
 * @spec Board only projects facts with an authoritative reader; legacy validation stamps are not evidence.
 * @see {@link component://docs/repository-toolkit.md}
 */
export declare function projectBoard(root: string, workspace?: WorkspaceContext, repo?: string, staleBindingHours?: number): Promise<Board>;
//# sourceMappingURL=projection.d.ts.map
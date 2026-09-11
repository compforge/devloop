import type { JsonObject } from "../../lib/config.js";
export declare const STATE_DIRECTORY_NAME = ".devloop";
export declare const WORKSPACE_STATE_FILE = "context.json";
export declare function stateDirectory(root: string): string;
export declare function workingTreeStateDirectory(root: string): string;
export declare function commitMessageFile(root: string): string;
export declare function temporaryDirectory(root: string): string;
export declare function branchSegment(branch: string | undefined, name: string): string;
export declare function workspaceStateFile(root: string): string;
export declare function segmentFile(root: string, name: string): string;
export declare function loadWorkspace(root: string): JsonObject | undefined;
export declare function saveWorkspace(root: string, data: JsonObject): void;
export declare function loadSegment(root: string, name: string): JsonObject | undefined;
export declare function saveSegment(root: string, name: string, data: JsonObject): void;
export declare function appendLedger(root: string, name: string, record: JsonObject): void;
//# sourceMappingURL=store.d.ts.map
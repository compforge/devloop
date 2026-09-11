import { type AgentsDocument } from "./base.js";
export interface Subproject {
    readonly name: string;
    readonly path: string;
    readonly aliases: readonly string[];
    readonly language?: string;
    readonly role?: string;
    readonly canonical?: string;
}
export interface WorkspaceContextRecord {
    readonly workspace_root: string;
    readonly agents_md: {
        readonly path?: string;
        readonly references?: readonly {
            readonly title?: string;
            readonly path?: string;
            readonly hook?: string;
        }[];
    };
    readonly subprojects: readonly {
        readonly name?: string;
        readonly path?: string;
        readonly aliases?: readonly string[];
        readonly language?: string;
        readonly role?: string;
        readonly canonical?: string;
    }[];
    readonly parsed_at: number;
}
export declare function discoverSubprojectNames(root: string): readonly string[];
/** Aggregate-workspace facts parsed from AGENTS.md and the filesystem. */
export declare class WorkspaceContext {
    readonly workspaceRoot: string;
    readonly agentsDocument: AgentsDocument;
    readonly subprojects: readonly Subproject[];
    readonly parsedAt: number;
    constructor(workspaceRoot: string, agentsDocument: AgentsDocument, subprojects: readonly Subproject[], parsedAt: number);
    static load(root: string): WorkspaceContext | undefined;
    static refresh(rootValue: string): WorkspaceContext;
    save(): void;
    isStale(ttl?: number): boolean;
}
//# sourceMappingURL=workspace.d.ts.map
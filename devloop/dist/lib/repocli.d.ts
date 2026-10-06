export declare class InspectionError extends Error {
}
export interface PackageTool {
    readonly name: string;
    readonly version: string;
    readonly evidence: readonly string[];
}
export interface ComponentInfo {
    readonly root: string;
    readonly name: string;
    readonly language: string | undefined;
    readonly packageTools: readonly PackageTool[];
}
/** A bounded protocol adapter, not a second repository scanner. */
export declare function inspectRepository(repo: string): readonly ComponentInfo[];
//# sourceMappingURL=repocli.d.ts.map
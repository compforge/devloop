import { Component } from "./repo-layout.js";
export interface WorkSet {
    readonly components: readonly Component[];
    readonly reason: string;
}
export declare function changedPaths(root: string): readonly string[];
export declare function changedPathsInScope(root: string, scopes: readonly string[]): readonly string[] | undefined;
export declare function committedPaths(root: string, revision?: string): readonly string[] | undefined;
export declare function rangePaths(root: string, base: string, head?: string): readonly string[] | undefined;
export declare function selectComponents(rootValue: string, options?: {
    readonly explicit?: string;
    readonly paths?: readonly string[];
}): WorkSet;
export declare function componentFingerprint(root: string, component: Component): string | undefined;
export declare function fuzzyScore(query: string, name: string): number | undefined;
//# sourceMappingURL=repo.d.ts.map
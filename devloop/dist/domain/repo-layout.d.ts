import { type ComponentInfo, type PackageTool } from "../lib/repocli.js";
/** Independently buildable and validatable directory within a repository. */
export declare class Component {
    readonly name: string;
    readonly packageTools: readonly PackageTool[];
    readonly path: string;
    readonly id: string;
    readonly language: string | undefined;
    private constructor();
    static at(pathValue: string, gitRoot: string): Component;
    static fromInfo(root: string, info: ComponentInfo): Component;
    hasTarget(name: string, suffix?: boolean): boolean;
    lintTarget(): string | undefined;
    testTarget(): string | undefined;
    testCommand(): readonly string[] | undefined;
    supportsLintFiles(): boolean;
    supportsTestFiles(): boolean;
    private makefileUses;
    focusedLintCommand(files: readonly string[], target?: string | undefined): readonly string[] | undefined;
    focusedTestCommand(files: readonly string[]): readonly string[] | undefined;
}
export declare function findGitRoot(path: string): string | undefined;
export declare function isGitRepository(path: string): boolean;
/** One operation's catalog; file ownership is a projection of declared roots. */
export declare class ComponentCatalog {
    readonly root: string;
    readonly components: readonly Component[];
    constructor(root: string);
    owner(target: string): Component | undefined;
    default(): Component;
}
export declare function inspectCatalog(root: string): ComponentCatalog;
export declare function defaultComponent(root: string): Component;
export declare function findRepoCodeDirectory(root: string): string;
export declare function owningComponent(target: string, root: string, catalog?: ComponentCatalog): Component | undefined;
export declare function enclosingComponent(target: string, root: string, catalog?: ComponentCatalog): Component;
export declare function discoverComponents(root: string): readonly Component[];
export declare function findAgentsDocument(repo: string, component?: string): string | undefined;
/** Repository identity independent of the caller's current directory. */
export interface Repo {
    readonly name: string;
    readonly root: string;
    readonly components: readonly Component[];
}
export declare function resolveRepo(path: string): Repo | undefined;
export declare function containsPath(repo: Repo, path: string): boolean;
//# sourceMappingURL=repo-layout.d.ts.map
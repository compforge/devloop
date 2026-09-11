/** Independently buildable and validatable directory within a repository. */
export declare class Component {
    readonly path: string;
    readonly id: string;
    readonly language: string | undefined;
    private constructor();
    static at(pathValue: string, gitRoot: string): Component;
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
export declare function defaultComponent(rootValue: string): Component;
export declare function findRepoCodeDirectory(rootValue: string): string;
export declare function owningComponent(targetValue: string, rootValue: string): Component | undefined;
export declare function enclosingComponent(target: string, root: string): Component;
export declare function discoverComponents(rootValue: string, maxDepth?: number): readonly Component[];
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
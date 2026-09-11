export type EcosystemName = "python" | "go" | "node";
export interface Ecosystem {
    readonly name: EcosystemName;
    readonly manifests: readonly string[];
    language(path: string): string;
    matchesLanguage(path: string): boolean;
    prepareCommand(path: string): readonly string[] | undefined;
    environmentProblem(path: string): string | undefined;
    markPrepared(path: string): void;
    fallbackTestCommand(path: string): readonly string[] | undefined;
    isTestFile(path: string): boolean;
}
export declare const ECOSYSTEMS: readonly Ecosystem[];
export declare function detectEcosystem(path: string): Ecosystem | undefined;
export declare function detectLanguage(path: string): string | undefined;
/** Prepare a component with the ecosystem's frozen install command. */
export declare function ensureEnvironmentReady(path: string): string | undefined;
//# sourceMappingURL=ecosystem.d.ts.map
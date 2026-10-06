export type EcosystemName = "python" | "go" | "node";
export interface Ecosystem {
    readonly name: EcosystemName;
    prepareCommand(path: string): readonly string[] | undefined;
    environmentProblem(path: string): string | undefined;
    markPrepared(path: string): void;
    fallbackTestCommand(path: string): readonly string[] | undefined;
}
export declare const ECOSYSTEMS: readonly Ecosystem[];
export declare function detectEcosystem(language: string | undefined): Ecosystem | undefined;
/** Prepare a component with the ecosystem's frozen install command. */
export declare function ensureEnvironmentReady(path: string, language?: string): string | undefined;
//# sourceMappingURL=ecosystem.d.ts.map
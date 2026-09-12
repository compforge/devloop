type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type JsonObject = {
    [key: string]: JsonValue;
};
export declare function expandPath(value: string): string;
export declare function configDirectory(): string;
export declare function configFile(): string;
export declare function pluginRoot(): string;
export declare function deepMerge(base: JsonObject, override: JsonObject): JsonObject;
/**
 * @spec Configuration inherits field by field: global < main repository < current checkout.
 * Explicit empty arrays and false values override; workspaces remains global-only.
 * @why Resolve default/repos within each source so a global repo override cannot defeat a local value.
 */
export declare function loadConfig(repo?: string): JsonObject;
export declare function saveConfig(data: JsonObject): void;
export declare function updateConfig(mutate: (data: JsonObject) => void): JsonObject;
export declare function workspaces(): readonly string[];
export declare function setWorkspaces(paths: readonly string[]): void;
export declare function forgeEntry(host: string, repo?: string): JsonObject;
export declare function forgeToken(host: string, provider: string, repo?: string): string | undefined;
export declare function lifecycleConfig(repo?: string): JsonObject;
export declare function architectureConfig(repo?: string): JsonObject;
export declare function worktreeConfig(repo?: string): JsonObject;
export declare function absoluteConfiguredPath(value: string): string;
export {};
//# sourceMappingURL=config.d.ts.map
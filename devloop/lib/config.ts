import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { mainRepoRoot } from "./git-state.js";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

const DEFAULTS: JsonObject = {
  workspaces: [],
  forges: {},
  lifecycle: { default: { pre_commit: [], post_commit: [], pre_mr: [], post_mr: [] }, repos: {} },
  arch: {
    default: {
      enabled: false,
      layers: { "/api/": "api", "/service/": "service", "/dao/": "dao", "/model/": "model" },
      order: ["api", "service", "dao", "model"],
    },
    repos: {},
  },
  worktree: { keep_recent: 5 },
};

function object(value: JsonValue | undefined): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function expandPath(value: string): string {
  let expanded = value.startsWith("~") ? join(homedir(), value.slice(1)) : value;
  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced: string, bare: string) => process.env[braced || bare] ?? "");
  return expanded;
}

export function configDirectory(): string {
  return process.env.DEVLOOP_CONFIG_DIR ? expandPath(process.env.DEVLOOP_CONFIG_DIR) : join(homedir(), ".devloop");
}

export function configFile(): string {
  return join(configDirectory(), "config.json");
}

export function pluginRoot(): string {
  return process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? resolve(dirname(new URL(import.meta.url).pathname), "..");
}

export function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = value !== null && typeof value === "object" && !Array.isArray(value)
      && current !== null && typeof current === "object" && !Array.isArray(current)
      ? deepMerge(current, value)
      : value;
  }
  return result;
}

function readJson(path: string): JsonObject | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : undefined;
  } catch {
    return undefined;
  }
}

function ancestorFiles(root: string): readonly string[] {
  const global = resolve(configFile());
  const home = resolve(homedir());
  const found: string[] = [];
  let current = root;
  while (true) {
    const candidate = join(current, ".devloop", "config.json");
    if (resolve(candidate) !== global && existsSync(candidate)) found.push(candidate);
    if (current === home || current === dirname(current)) break;
    current = dirname(current);
  }
  return found.reverse();
}

/** Resolve the path-keyed policy syntax within one source, before applying closer sources. */
function resolveLayer(layer: JsonObject, repoKeys: readonly string[]): JsonObject {
  const result = { ...layer };
  for (const name of ["lifecycle", "arch"]) {
    if (!(name in layer)) continue;
    const section = object(layer[name]);
    let policy = object(section.default);
    for (const key of repoKeys) policy = deepMerge(policy, object(object(section.repos)[key]));
    result[name] = { ...section, default: policy };
  }
  return result;
}

/**
 * @spec Configuration inherits field by field: global < main repository < current checkout.
 * Explicit empty arrays and false values override; workspaces remains global-only.
 * @why Resolve default/repos within each source so a global repo override cannot defeat a local value.
 */
export function loadConfig(repo?: string): JsonObject {
  const checkout = repo ? resolve(expandPath(repo)) : undefined;
  const repoKeys = checkout ? [...new Set([mainRepoRoot(checkout), checkout])] : [];
  const files = [...new Set(repoKeys.flatMap(ancestorFiles))];
  const global = deepMerge(DEFAULTS, readJson(configFile()) ?? {});
  let result = resolveLayer(global, repoKeys);
  for (const path of files) result = deepMerge(result, resolveLayer(readJson(path) ?? {}, repoKeys));
  result.workspaces = global.workspaces ?? [];
  return result;
}

export function saveConfig(data: JsonObject): void {
  const path = configFile();
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

export function updateConfig(mutate: (data: JsonObject) => void): JsonObject {
  const data = deepMerge(DEFAULTS, readJson(configFile()) ?? {});
  mutate(data);
  saveConfig(data);
  return data;
}

export function workspaces(): readonly string[] {
  const values = deepMerge(DEFAULTS, readJson(configFile()) ?? {}).workspaces;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string").map(expandPath) : [];
}

export function setWorkspaces(paths: readonly string[]): void {
  updateConfig((data) => { data.workspaces = [...paths]; });
}

export function forgeEntry(host: string, repo?: string): JsonObject {
  return object(object(loadConfig(repo).forges)[host]);
}

export function forgeToken(host: string, provider: string, repo?: string): string | undefined {
  const variables = provider === "github" ? ["GITHUB_TOKEN", "GH_TOKEN"] : provider === "gitlab" ? ["GITLAB_TOKEN"] : [];
  for (const variable of variables) {
    const token = process.env[variable]?.trim();
    if (token) return token;
  }
  const configured = forgeEntry(host, repo).token;
  return typeof configured === "string" && configured.trim() ? configured.trim() : undefined;
}

export function lifecycleConfig(repo?: string): JsonObject { return object(object(loadConfig(repo).lifecycle).default); }
export function architectureConfig(repo?: string): JsonObject { return object(object(loadConfig(repo).arch).default); }
export function worktreeConfig(repo?: string): JsonObject { return object(loadConfig(repo).worktree); }

export function absoluteConfiguredPath(value: string): string {
  const expanded = expandPath(value);
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

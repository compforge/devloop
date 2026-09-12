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

function localFiles(repo?: string): readonly string[] {
  if (!repo) return [];
  const global = resolve(configFile());
  const home = resolve(homedir());
  const found: string[] = [];
  let current = resolve(expandPath(repo));
  while (true) {
    const candidate = join(current, ".devloop", "config.json");
    if (resolve(candidate) !== global && existsSync(candidate)) found.push(candidate);
    if (current === home || current === dirname(current)) break;
    current = dirname(current);
  }
  return found.reverse();
}

export function loadConfig(repo?: string): JsonObject {
  return [DEFAULTS, readJson(configFile()) ?? {}, ...localFiles(repo).map((path) => readJson(path) ?? {})]
    .reduce((result, layer) => deepMerge(result, layer), {});
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

/** @spec Repo policy is inherited by linked worktrees; explicit checkout overrides win. */
function resolvedRepoSection(name: "lifecycle" | "arch", repo?: string): JsonObject {
  const section = object(loadConfig(repo)[name]);
  let result = { ...object(section.default) };
  if (repo) {
    const checkout = resolve(expandPath(repo));
    for (const key of new Set([mainRepoRoot(checkout), checkout])) {
      result = deepMerge(result, object(object(section.repos)[key]));
    }
  }
  return result;
}

export function lifecycleConfig(repo?: string): JsonObject { return resolvedRepoSection("lifecycle", repo); }
export function architectureConfig(repo?: string): JsonObject { return resolvedRepoSection("arch", repo); }
export function worktreeConfig(repo?: string): JsonObject { return object(loadConfig(repo).worktree); }

export function absoluteConfiguredPath(value: string): string {
  const expanded = expandPath(value);
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

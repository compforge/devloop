import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { mainRepoRoot } from "./git-state.js";
const DEFAULTS = {
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
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function expandPath(value) {
    let expanded = value.startsWith("~") ? join(homedir(), value.slice(1)) : value;
    expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => process.env[braced || bare] ?? "");
    return expanded;
}
export function configDirectory() {
    return process.env.DEVLOOP_CONFIG_DIR ? expandPath(process.env.DEVLOOP_CONFIG_DIR) : join(homedir(), ".devloop");
}
export function configFile() {
    return join(configDirectory(), "config.json");
}
export function pluginRoot() {
    return process.env.PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? resolve(dirname(new URL(import.meta.url).pathname), "..");
}
export function deepMerge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        const current = result[key];
        result[key] = value !== null && typeof value === "object" && !Array.isArray(value)
            && current !== null && typeof current === "object" && !Array.isArray(current)
            ? deepMerge(current, value)
            : value;
    }
    return result;
}
function readJson(path) {
    if (!existsSync(path))
        return undefined;
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function localFiles(repo) {
    if (!repo)
        return [];
    const global = resolve(configFile());
    const home = resolve(homedir());
    const found = [];
    let current = resolve(expandPath(repo));
    while (true) {
        const candidate = join(current, ".devloop", "config.json");
        if (resolve(candidate) !== global && existsSync(candidate))
            found.push(candidate);
        if (current === home || current === dirname(current))
            break;
        current = dirname(current);
    }
    return found.reverse();
}
export function loadConfig(repo) {
    return [DEFAULTS, readJson(configFile()) ?? {}, ...localFiles(repo).map((path) => readJson(path) ?? {})]
        .reduce((result, layer) => deepMerge(result, layer), {});
}
export function saveConfig(data) {
    const path = configFile();
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(temporary, path);
}
export function updateConfig(mutate) {
    const data = deepMerge(DEFAULTS, readJson(configFile()) ?? {});
    mutate(data);
    saveConfig(data);
    return data;
}
export function workspaces() {
    const values = deepMerge(DEFAULTS, readJson(configFile()) ?? {}).workspaces;
    return Array.isArray(values) ? values.filter((value) => typeof value === "string").map(expandPath) : [];
}
export function setWorkspaces(paths) {
    updateConfig((data) => { data.workspaces = [...paths]; });
}
export function forgeEntry(host, repo) {
    return object(object(loadConfig(repo).forges)[host]);
}
export function forgeToken(host, provider, repo) {
    const variables = provider === "github" ? ["GITHUB_TOKEN", "GH_TOKEN"] : provider === "gitlab" ? ["GITLAB_TOKEN"] : [];
    for (const variable of variables) {
        const token = process.env[variable]?.trim();
        if (token)
            return token;
    }
    const configured = forgeEntry(host, repo).token;
    return typeof configured === "string" && configured.trim() ? configured.trim() : undefined;
}
/** @spec Repo policy is inherited by linked worktrees; explicit checkout overrides win. */
function resolvedRepoSection(name, repo) {
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
export function lifecycleConfig(repo) { return resolvedRepoSection("lifecycle", repo); }
export function architectureConfig(repo) { return resolvedRepoSection("arch", repo); }
export function worktreeConfig(repo) { return object(loadConfig(repo).worktree); }
export function absoluteConfiguredPath(value) {
    const expanded = expandPath(value);
    return isAbsolute(expanded) ? expanded : resolve(expanded);
}
//# sourceMappingURL=config.js.map
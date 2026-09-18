import { basename } from "node:path";
import { formatTimestamp } from "../context/base.js";
function rows(value) { return Array.isArray(value) ? value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item)) : []; }
function text(value) { return typeof value === "string" ? value : ""; }
function number(value) { return typeof value === "number" ? value : 0; }
function reference(item) {
    const title = text(item.title) || "?";
    const path = text(item.path);
    const description = text(item.description).trim();
    const base = basename(path);
    return description && description !== base && description !== path ? `${title} — ${description}  ← ${base}` : `${title}  ← ${base}`;
}
export function renderItem(item) {
    const payload = item.payload;
    if (item.type === "workspace") {
        const lines = [`[Workspace: ${text(payload.root)}]`];
        const references = rows(payload.references);
        if (references.length)
            lines.push("AGENTS.md references (Read when the task touches these topics):", ...references.map((row) => `  - ${reference(row)}`));
        const projects = rows(payload.subprojects);
        if (projects.length)
            lines.push("Subprojects:", ...projects.slice(0, 12).map((project) => {
                const aliases = Array.isArray(project.aliases) && project.aliases.length ? ` (${project.aliases.join(", ")})` : "";
                const note = [text(project.language), text(project.role)].filter(Boolean).join(" · ");
                return `  - ${text(project.name)}${aliases}: ${note}${text(project.canonical) ? ` → ${text(project.canonical)}` : ""}`;
            }));
        return lines.join("\n");
    }
    if (item.type === "repo.references")
        return ["Repo AGENTS.md references (Read when the task touches these topics):", ...rows(payload.references).map((row) => `  - ${reference(row)}`)].join("\n");
    if (item.type === "repo.identity") {
        const dirty = payload.workspaceDirty ? `dirty(${number(payload.modifiedCount)} modified, ${number(payload.untrackedCount)} untracked)` : "clean";
        const warnings = [payload.protected ? "PROTECTED" : "", typeof payload.staleBindingHours === "number" ? `repo binding is ${payload.staleBindingHours.toFixed(1)}h old; confirm the repo with cd` : ""].filter(Boolean);
        return `[Current repo: ${text(payload.codeDir)} (${text(payload.language) || "?"})] | Branch: ${text(payload.branch) || "?"}${payload.linkedWorktree ? " (worktree)" : ""} (ahead ${number(payload.ahead)}, behind ${number(payload.behind)} vs ${text(payload.baseBranch)}, target=${text(payload.targetBranch)}) | Workspace: ${dirty}${warnings.length ? ` ⚠️ ${warnings.join("; ")}` : ""}`;
    }
    if (item.type === "repo.validation") {
        const components = rows(payload.components);
        const history = components.length === 0 ? "Validation history: no recorded runs" : `Validation: ${components.map((row) => `${text(row.component)}: lint=${formatTimestamp(typeof row.lintAt === "number" ? row.lintAt : undefined)}, test=${formatTimestamp(typeof row.testAt === "number" ? row.testAt : undefined)}`).join(" | ")}`;
        const analysis = payload.analysis;
        const scopes = rows(analysis?.checks).map((row) => `${text(row.component)} ${text(row.check)}=${text(row.scope)} (${text(row.reason)})`);
        return [history, ...(scopes.length ? [`Latest validation scope: ${scopes.join(" | ")}`] : [])].join("\n");
    }
    if (item.type === "repo.review")
        return renderReview(payload);
    return "";
}
export function renderPrompt(items) {
    return items.map(renderItem).filter(Boolean).join("\n\n");
}
function renderReview(payload) {
    const status = text(payload.status);
    const sha = text(payload.reviewedSha).slice(0, 9);
    const artifact = text(payload.artifactPath);
    if (status === "running" || status === "stale")
        return `Review: ${status} on ${sha}; see ${artifact}`;
    const parts = [];
    const findings = number(payload.findings);
    const failed = number(payload.failedFiles);
    if (findings)
        parts.push(`${findings} finding(s)`);
    if (failed)
        parts.push(`${failed} file(s) failed`);
    if (status === "error" || status === "failed")
        parts.push("review errored");
    else if (status === "completed_with_errors")
        parts.push("review incomplete");
    else if (status === "completed_with_warnings")
        parts.push("review warnings");
    else if (status !== "success")
        parts.push(`review ${status}`);
    const message = text(payload.message).trim();
    const reason = status !== "success" && message ? ` — ${message}` : "";
    return `Review: ${parts.length ? parts.join(", ") : "clean (no findings)"} on ${sha}${reason}; see ${artifact}`;
}
//# sourceMappingURL=render.js.map
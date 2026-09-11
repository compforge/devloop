import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
function read(path) {
    if (!existsSync(path))
        return undefined;
    try {
        return readFileSync(path, "utf8");
    }
    catch {
        return undefined;
    }
}
function concretePath(value, base) {
    if (value.includes("<") || value.includes(">"))
        return value;
    const expanded = value.startsWith("~") ? `${process.env.HOME ?? ""}${value.slice(1)}` : value;
    return isAbsolute(expanded) ? expanded : resolve(base, expanded);
}
export function parseReferencesSection(path) {
    const content = read(path);
    if (content === undefined)
        return [];
    const match = /^##\s+References?\s*$/im.exec(content);
    if (!match?.index && match?.index !== 0)
        return [];
    const tail = content.slice(match.index + match[0].length);
    const block = tail.slice(0, /^##\s+/m.exec(tail)?.index ?? tail.length);
    const entries = [];
    for (const raw of block.split("\n")) {
        const body = raw.trim();
        if (!body.startsWith("-"))
            continue;
        const value = body.replace(/^-\s*/, "");
        const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(value);
        if (link?.[1] && link[2]) {
            const before = value.slice(0, link.index).replace(/[:：—-]+$/, "").trim();
            const after = value.slice(link.index + link[0].length).replace(/^[:：—-]+/, "").trim();
            const title = before || link[1].trim();
            const description = before ? [link[1] !== link[2] ? link[1] : "", after].filter(Boolean).join(" ") : after || link[1];
            entries.push({ title, path: concretePath(link[2].trim(), dirname(path)), description });
            continue;
        }
        const bare = /`([^`]+\.md)`/.exec(value);
        if (bare?.[1]) {
            const description = `${value.slice(0, bare.index)} ${value.slice(bare.index + bare[0].length)}`.replace(/[:：—-]+/g, " ").trim();
            entries.push({ title: basename(bare[1]), path: concretePath(bare[1], dirname(path)), description: description || basename(bare[1]) });
        }
    }
    return entries;
}
export function parseSubprojectsSection(path) {
    const content = read(path);
    if (content === undefined)
        return [];
    const header = /^(#{2,4})\s+(?:子项目清单|Subprojects?)\s*$/im.exec(content);
    if (!header?.[1])
        return [];
    const tail = content.slice((header.index ?? 0) + header[0].length);
    const next = new RegExp(`^#{2,${header[1].length}}\\s+`, "m").exec(tail);
    const lines = tail.slice(0, next?.index ?? tail.length).split("\n").filter((line) => line.trim().startsWith("|"));
    if (lines.length < 3 || lines[0] === undefined)
        return [];
    const headers = lines[0].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    return lines.slice(2).flatMap((line) => {
        const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim().replace(/^`|`$/g, ""));
        if (cells.length < headers.length || !cells[0])
            return [];
        const names = cells[0].replace(/`/g, "").split("/").map((name) => name.trim()).filter(Boolean);
        const entry = {
            name: names[0], path: names[0], aliases: names.slice(1),
        };
        headers.forEach((name, index) => {
            const value = cells[index] ?? "";
            const lower = name.toLowerCase();
            if ((name.includes("简称") || lower.includes("alias")) && value)
                entry.aliases.push(...value.split("/").map((part) => part.trim()).filter(Boolean));
            else if (name.includes("语言") || lower.includes("language"))
                entry.language = value;
            else if (name.includes("角色") || lower.includes("role"))
                entry.role = value;
            else if (name.includes("备注") || lower.includes("note"))
                entry.note = value;
        });
        if (!entry.role && entry.note)
            entry.role = entry.note;
        entry.aliases = [...new Set(entry.aliases.filter((alias) => alias !== entry.name))];
        return [entry];
    });
}
//# sourceMappingURL=parsers.js.map
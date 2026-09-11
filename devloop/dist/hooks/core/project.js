import { basename, isAbsolute, resolve } from "node:path";
const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit", "write", "edit", "str_replace_editor", "apply_patch"]);
function splitShell(command) {
    const parts = [];
    let current = "";
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            current += char;
            escaped = true;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote)
                quote = "";
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            current += char;
            continue;
        }
        if (char === "(") {
            depth += 1;
            current += char;
            continue;
        }
        if (char === ")") {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }
        const pair = command.slice(index, index + 2);
        if (depth === 0 && (pair === "&&" || pair === "||")) {
            if (current.trim())
                parts.push(current.trim());
            current = "";
            index += 1;
            continue;
        }
        if (depth === 0 && (char === ";" || char === "\n" || char === "|")) {
            if (current.trim())
                parts.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    if (current.trim())
        parts.push(current.trim());
    return parts;
}
function shellWords(command) {
    const words = [];
    let current = "";
    let quote = "";
    let escaped = false;
    for (const char of command.trim()) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote)
                quote = "";
            else
                current += char;
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }
        if (/\s/.test(char) || "(){}".includes(char)) {
            if (current) {
                words.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (!quote && current)
        words.push(current);
    return quote ? [] : words;
}
function commandTarget(words, base) {
    const environment = [];
    let offset = 0;
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[offset] ?? ""))
        environment.push(words[offset++]);
    let argv = words.slice(offset);
    if (argv.length === 0)
        return undefined;
    let workingDirectory = base;
    let dashC;
    if (["git", "go", "make"].includes(basename(argv[0]))) {
        const index = argv.indexOf("-C");
        if (index >= 0 && argv[index + 1]) {
            const configuredPath = argv[index + 1];
            dashC = configuredPath;
            const path = isAbsolute(configuredPath) ? configuredPath : base.path ? resolve(base.path, configuredPath) : undefined;
            workingDirectory = { ...(path ? { path } : {}), source: "git -C" };
            if (basename(argv[0]) === "git")
                argv = [...argv.slice(0, index), ...argv.slice(index + 2)];
        }
    }
    let subcommand;
    let args = argv.slice(1);
    if (basename(argv[0]) === "git") {
        let index = 1;
        while (index < argv.length && argv[index].startsWith("-")) {
            if (["-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(argv[index]))
                index += 2;
            else
                index += 1;
        }
        subcommand = argv[index];
        args = argv.slice(index + 1);
    }
    return { kind: "command", argv, workingDirectory, environment, ...(subcommand ? { subcommand } : {}), args, ...(dashC ? { dashC } : {}) };
}
function commandTargets(command, base) {
    const targets = [];
    let current = base;
    for (const part of splitShell(command)) {
        const trimmed = part.trim();
        if (trimmed.startsWith("(") && matchingParen(trimmed, 0) === trimmed.length - 1) {
            targets.push(...commandTargets(trimmed.slice(1, -1), current));
            continue;
        }
        for (const nested of commandSubstitutions(trimmed))
            targets.push(...commandTargets(nested, current));
        const words = shellWords(part);
        if (words[0] === "cd" && words[1]) {
            const path = isAbsolute(words[1]) ? words[1] : current.path ? resolve(current.path, words[1]) : undefined;
            current = { ...(path ? { path } : {}), source: "command cd" };
            continue;
        }
        const wrapped = wrappedCommand(words);
        if (wrapped) {
            targets.push(...commandTargets(wrapped, current));
            continue;
        }
        const target = commandTarget(words, current);
        if (target)
            targets.push(target);
    }
    const heredoc = /(?:^|(?:&&|\|\||;)\s*)(?:\S*\/)?apply_patch\s+<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*\n([\s\S]*?)\n\s*\1\s*(?=\n|$)/gm;
    for (const match of command.matchAll(heredoc)) {
        for (const target of patchFileChanges(match[2])) {
            targets.push({
                ...target,
                path: isAbsolute(target.path) || !current.path ? target.path : resolve(current.path, target.path),
            });
        }
    }
    return targets;
}
/** Unwrap the common launchers agents use around a shell command so policy sees the actual mutation. */
function wrappedCommand(words) {
    const executable = basename(words[0] ?? "");
    if (["bash", "sh", "zsh"].includes(executable)) {
        const commandIndex = words.findIndex((word, index) => index > 0 && /^-[^-]*c/.test(word));
        return commandIndex >= 0 ? words[commandIndex + 1] : undefined;
    }
    if (executable === "env") {
        let index = 1;
        while (index < words.length && (words[index].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])))
            index += 1;
        return index < words.length ? words.slice(index).join(" ") : undefined;
    }
    if (["command", "builtin", "exec"].includes(executable)) {
        let index = 1;
        while (index < words.length && words[index].startsWith("-"))
            index += 1;
        return index < words.length ? words.slice(index).join(" ") : undefined;
    }
    return undefined;
}
function matchingParen(source, start) {
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote)
                quote = "";
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }
        if (char === "(")
            depth += 1;
        else if (char === ")" && --depth === 0)
            return index;
    }
    return -1;
}
function commandSubstitutions(source) {
    const values = [];
    let quote = "";
    let escaped = false;
    for (let index = 0; index < source.length - 1; index += 1) {
        const char = source[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote)
                quote = "";
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }
        if (char === "$" && source[index + 1] === "(") {
            const end = matchingParen(source, index + 1);
            if (end > index) {
                values.push(source.slice(index + 2, end));
                index = end;
            }
        }
    }
    return values;
}
export function patchFileChanges(value) {
    if (typeof value !== "string")
        return [];
    return value.split("\n").flatMap((line) => {
        for (const [prefix, mode] of [["*** Add File: ", "write"], ["*** Update File: ", "edit"], ["*** Delete File: ", "edit"]]) {
            if (line.startsWith(prefix))
                return [{ kind: "file_change", path: line.slice(prefix.length).trim(), mode }];
        }
        return [];
    });
}
/** Map each harness payload into the same policy Change. */
export function projectTool(input) {
    const { toolName, toolInput, cwd } = input;
    if (toolName === "Bash" || toolName === "bash" || toolName === "shell" || toolName === "exec_command") {
        const command = typeof toolInput.command === "string" ? toolInput.command : typeof toolInput.cmd === "string" ? toolInput.cmd : "";
        const configured = typeof toolInput.workdir === "string" && toolInput.workdir.trim() ? toolInput.workdir : undefined;
        const path = configured ? (isAbsolute(configured) ? configured : resolve(cwd, configured)) : input.harness === "codex" && toolName === "Bash" ? undefined : cwd;
        return { targets: commandTargets(command, { ...(path ? { path } : {}), source: configured ? "tool workdir" : "hook cwd" }), cwd, tool: toolName, command };
    }
    if (toolName === "apply_patch") {
        const patch = toolInput.patch ?? toolInput.input ?? toolInput.command;
        return { targets: patchFileChanges(patch), cwd, tool: toolName, command: "" };
    }
    if (FILE_TOOLS.has(toolName)) {
        if (toolName === "str_replace_editor" && toolInput.command === "view")
            return { targets: [], cwd, tool: toolName, command: "" };
        const path = typeof toolInput.file_path === "string" ? toolInput.file_path
            : typeof toolInput.notebook_path === "string" ? toolInput.notebook_path
                : typeof toolInput.path === "string" ? toolInput.path : "";
        const writing = toolName === "Write" || toolName === "write" || toolName === "str_replace_editor" && toolInput.command === "create";
        return { targets: path ? [{ kind: "file_change", path, mode: writing ? "write" : "edit", toolInput }] : [], cwd, tool: toolName, command: "" };
    }
    return { targets: [], cwd, tool: toolName, command: "" };
}
//# sourceMappingURL=project.js.map
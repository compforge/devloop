import { existsSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appendLedger, stateDirectory } from "./store.js";
export const TOOL_CALL_SCHEMA = "devloop.tool-call/v1";
const FILE_NAME = "tool-calls.jsonl";
const WINDOW_SECONDS = 3_600;
const COMPACT_INTERVAL_SECONDS = 60;
export function appendToolCall(root, record, at = Date.now() / 1_000) {
    const directory = stateDirectory(root);
    const path = join(directory, FILE_NAME);
    const marker = join(directory, "tool-calls.compact");
    try {
        const due = !existsSync(marker) || at - statSync(marker).mtimeMs / 1_000 >= COMPACT_INTERVAL_SECONDS;
        if (due) {
            compact(path, at - WINDOW_SECONDS);
            writeFileSync(marker, "", { flag: "a" });
            utimesSync(marker, at, at);
        }
        appendLedger(root, "tool-calls", record);
    }
    catch { /* observability never gates a tool */ }
}
export function toolCallStartedAt(root, callId, at = Date.now() / 1_000) {
    if (!callId)
        return undefined;
    try {
        const rows = readFileSync(join(stateDirectory(root), FILE_NAME), "utf8").trimEnd().split("\n").reverse();
        for (const row of rows) {
            let value;
            try {
                value = JSON.parse(row);
            }
            catch {
                continue;
            }
            if (value === null || typeof value !== "object" || Array.isArray(value))
                continue;
            const record = value;
            if (typeof record.ts !== "number")
                continue;
            if (record.ts < at - WINDOW_SECONDS)
                break;
            if (record.schema === TOOL_CALL_SCHEMA && record.phase === "started" && record.call_id === callId)
                return record.ts;
        }
    }
    catch { /* missing timeline */ }
    return undefined;
}
function compact(path, cutoff) {
    if (!existsSync(path))
        return;
    try {
        const retained = readFileSync(path, "utf8").split("\n").flatMap((line) => {
            try {
                const record = JSON.parse(line);
                return record !== null && typeof record === "object" && !Array.isArray(record)
                    && typeof record.ts === "number"
                    && record.ts >= cutoff ? [JSON.stringify(record)] : [];
            }
            catch {
                return [];
            }
        });
        const temporary = `${path}.${process.pid}.tmp`;
        writeFileSync(temporary, retained.map((line) => `${line}\n`).join(""), "utf8");
        renameSync(temporary, path);
    }
    catch { /* best-effort compaction */ }
}
//# sourceMappingURL=tool-calls.js.map
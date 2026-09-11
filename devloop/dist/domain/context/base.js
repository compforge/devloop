import { createHash } from "node:crypto";
export const REPO_STALE_SECONDS = 300;
export const WORKSPACE_STALE_SECONDS = 600;
export const TURN_TTL_SECONDS = 1_800;
export const SESSION_TTL_SECONDS = 14_400;
export const LOCAL_PR_POLL_CONCURRENCY = 4;
export const REMOTE_VIEW_STALE_SECONDS = 120;
export const ACTIVE_REPO_TTL_SECONDS = 21_600;
export const REVIEW_STALE_SECONDS = 1_800;
export const DEFAULT_BRANCH_TTL_SECONDS = 86_400;
export const REVIEW_FINDING_NUDGE_CAP = 3;
export const REVIEW_NUDGE_CAP = 1;
export function referenceFrom(entry) {
    return { title: entry.title, path: entry.path, ...(entry.description ? { hook: entry.description } : {}) };
}
/** Content-addressed delivery cursor with a TTL replay backstop. */
export class Cadence {
    lastHash;
    lastEmitAt;
    constructor(record = {}) {
        this.lastHash = record.last_hash;
        this.lastEmitAt = record.last_emit_at;
    }
    shouldEmit(text, at, ttl) {
        return text !== "" && (contentHash(text) !== this.lastHash || this.lastEmitAt === undefined || at - this.lastEmitAt >= ttl);
    }
    mark(text, at) { this.lastHash = contentHash(text); this.lastEmitAt = at; }
    clear() { this.lastHash = undefined; this.lastEmitAt = undefined; }
    toJSON() { return { ...(this.lastHash ? { last_hash: this.lastHash } : {}), ...(this.lastEmitAt !== undefined ? { last_emit_at: this.lastEmitAt } : {}) }; }
}
export function contentHash(text) { return createHash("sha1").update(text).digest("hex"); }
export function now() { return Date.now() / 1_000; }
export function stale(timestamp, ttl, at = now()) { return timestamp === undefined || at - timestamp >= ttl; }
export function formatTimestamp(timestamp) {
    if (!timestamp)
        return "never";
    const date = new Date(timestamp * 1_000);
    if (Number.isNaN(date.valueOf()))
        return "never";
    const fields = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
    const [year, month, day, hour, minute] = fields.map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"));
    return `${year}-${month}-${day} ${hour}:${minute}`;
}
//# sourceMappingURL=base.js.map
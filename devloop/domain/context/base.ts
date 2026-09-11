import { createHash } from "node:crypto";
import type { ReferenceEntry } from "../../lib/parsers.js";

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

export interface Reference {
  readonly title: string;
  readonly path: string;
  readonly hook?: string;
}

export interface AgentsDocument {
  readonly path?: string;
  readonly references: readonly Reference[];
}

export function referenceFrom(entry: ReferenceEntry): Reference {
  return { title: entry.title, path: entry.path, ...(entry.description ? { hook: entry.description } : {}) };
}

export interface CadenceRecord { last_hash?: string; last_emit_at?: number }

/** Content-addressed delivery cursor with a TTL replay backstop. */
export class Cadence {
  lastHash: string | undefined;
  lastEmitAt: number | undefined;

  constructor(record: CadenceRecord = {}) {
    this.lastHash = record.last_hash;
    this.lastEmitAt = record.last_emit_at;
  }

  shouldEmit(text: string, at: number, ttl: number): boolean {
    return text !== "" && (contentHash(text) !== this.lastHash || this.lastEmitAt === undefined || at - this.lastEmitAt >= ttl);
  }

  mark(text: string, at: number): void { this.lastHash = contentHash(text); this.lastEmitAt = at; }
  clear(): void { this.lastHash = undefined; this.lastEmitAt = undefined; }
  toJSON(): CadenceRecord { return { ...(this.lastHash ? { last_hash: this.lastHash } : {}), ...(this.lastEmitAt !== undefined ? { last_emit_at: this.lastEmitAt } : {}) }; }
}

export function contentHash(text: string): string { return createHash("sha1").update(text).digest("hex"); }
export function now(): number { return Date.now() / 1_000; }
export function stale(timestamp: number | undefined, ttl: number, at = now()): boolean { return timestamp === undefined || at - timestamp >= ttl; }

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return "never";
  const date = new Date(timestamp * 1_000);
  if (Number.isNaN(date.valueOf())) return "never";
  const fields = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
  const [year, month, day, hour, minute] = fields.map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"));
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

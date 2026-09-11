import { unlinkSync } from "node:fs";
import { REVIEW_FINDING_NUDGE_CAP, REVIEW_NUDGE_CAP, SESSION_TTL_SECONDS, TURN_TTL_SECONDS, now } from "../context/base.js";
import { loadSegment, saveSegment, segmentFile } from "../context/store.js";
import { sessionName } from "../context/session.js";
import type { JsonObject } from "../../lib/config.js";
import type { BoardItem, BoardItemType, BoardView } from "./model.js";
import { renderPrompt } from "./render.js";

export type DeliveryChannel = "prompt" | "ui";
export type PromptScope = "session" | "turn";
export type PromptTrigger = "session_start" | "user_prompt";
interface DeliveryRule { readonly channels: readonly DeliveryChannel[]; readonly promptScope?: PromptScope; readonly maxDeliveries?: number; readonly replayAfterCompact: boolean }
interface DeliveryMark { item_type: string; signature: string; count: number; last_emit_at?: number }

const RULES: Readonly<Record<BoardItemType, DeliveryRule>> = {
  workspace: { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
  "repo.references": { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
  "repo.identity": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
  "repo.validation": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
  "repo.pr-blocked": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: 1, replayAfterCompact: false },
  "repo.review": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: REVIEW_NUDGE_CAP, replayAfterCompact: false },
  "repo.review-findings": { channels: ["prompt", "ui"], promptScope: "turn", maxDeliveries: REVIEW_FINDING_NUDGE_CAP, replayAfterCompact: false },
  "repo.pr-history": { channels: ["ui"], replayAfterCompact: true },
};

export function itemsFor(view: BoardView, channel: DeliveryChannel): readonly BoardItem[] {
  return view.items.filter((item) => RULES[item.type].channels.includes(channel));
}

export class PromptDelivery {
  constructor(readonly root: string, readonly sessionId?: string) {}
  private segment(): string { return `board/sessions/${sessionName(this.sessionId)}`; }
  private load(): Record<string, DeliveryMark> {
    const raw = loadSegment(this.root, this.segment())?.items;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
      const row = value as Record<string, unknown>;
      return [[key, { item_type: text(row.item_type ?? row.item_key), signature: text(row.signature), count: number(row.count), ...(typeof row.last_emit_at === "number" ? { last_emit_at: row.last_emit_at } : {}) }]];
    }));
  }
  deliver(view: BoardView, trigger: PromptTrigger = "user_prompt"): string | undefined {
    const receipt = this.load(); const at = now(); const due = view.items.filter((item) => {
      const rule = RULES[item.type]; if (!rule.channels.includes("prompt") || trigger === "session_start" && rule.promptScope !== "session") return false;
      const mark = receipt[item.id]; if (!mark || mark.signature !== item.signature) return true;
      if (rule.maxDeliveries !== undefined) return mark.count < rule.maxDeliveries;
      const ttl = rule.promptScope === "session" ? SESSION_TTL_SECONDS : TURN_TTL_SECONDS;
      return mark.last_emit_at === undefined || at - mark.last_emit_at >= ttl;
    });
    if (due.length === 0) return undefined;
    for (const item of due) {
      const previous = receipt[item.id]; const same = previous?.signature === item.signature;
      receipt[item.id] = { item_type: item.type, signature: item.signature, count: same ? previous.count + 1 : 1, last_emit_at: at };
    }
    saveSegment(this.root, this.segment(), { items: receipt } as unknown as JsonObject);
    return renderPrompt(due);
  }
  afterCompact(): void {
    const receipt = this.load(); let changed = false;
    for (const mark of Object.values(receipt)) {
      const type = mark.item_type as BoardItemType; const rule = RULES[type];
      if (rule?.replayAfterCompact) { mark.signature = ""; mark.count = 0; delete mark.last_emit_at; changed = true; }
    }
    if (changed) saveSegment(this.root, this.segment(), { items: receipt } as unknown as JsonObject);
  }
  clear(): void { try { unlinkSync(segmentFile(this.root, this.segment())); } catch { /* absent */ } }
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function number(value: unknown): number { return typeof value === "number" ? value : 0; }

import { unlinkSync } from "node:fs";
import { loadSegment, saveSegment, segmentFile } from "../context/store.js";
import { sessionName } from "../context/session.js";
import { boardItem } from "./model.js";
const RULES = {
    workspace: { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
    "repo.references": { channels: ["prompt", "ui"], promptScope: "session", replayAfterCompact: true },
    "repo.pull-request": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
    "repo.identity": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
    "repo.validation": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: true },
    "repo.pr-blocked": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: false },
    "repo.review": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: false },
    "repo.review-findings": { channels: ["prompt", "ui"], promptScope: "turn", replayAfterCompact: false },
    "repo.pr-history": { channels: ["ui"], replayAfterCompact: true },
};
export function itemsFor(view, channel) {
    return view.items.filter(item => RULES[item.type].channels.includes(channel));
}
export class PromptDelivery {
    root;
    sessionId;
    constructor(root, sessionId) {
        this.root = root;
        this.sessionId = sessionId;
    }
    segment() { return `board/sessions/${sessionName(this.sessionId)}`; }
    load() {
        const raw = loadSegment(this.root, this.segment());
        const items = raw?.items;
        if (items === null || typeof items !== "object" || Array.isArray(items))
            return { items: {} };
        const marks = {};
        for (const [id, value] of Object.entries(items)) {
            if (!value || typeof value !== "object" || Array.isArray(value))
                continue;
            const row = value, type = row.item_type;
            if (!Object.hasOwn(RULES, type) || typeof row.signature !== "string")
                continue;
            const scope = row.scope;
            marks[id] = { item_type: type, signature: row.signature,
                ...(scope && typeof scope.workspaceRoot === "string" && (scope.repoRoot === undefined || typeof scope.repoRoot === "string") ? { scope } : {}) };
        }
        return { items: marks, ...(typeof raw?.focus === "string" ? { focus: raw.focus } : {}) };
    }
    /**
     * @spec Only new, changed or removed visible items are delivered. Elapsed time never reopens delivery.
     * @spec Inspection is read-only; acknowledgment advances only the inspected revisions.
     * @spec Repository facts outside an explicit focus retain their receipts, including a workspace-only focus.
     * @see {@link component://docs/board.md}
     */
    delta(view, trigger = "user_prompt") {
        const receipt = this.load(), focus = view.focus?.repoRoot ?? view.root;
        const changedFocus = receipt.focus !== undefined && receipt.focus !== focus;
        const eligible = (type) => RULES[type]?.channels.includes("prompt") && (trigger !== "session_start" || RULES[type].promptScope === "session");
        const present = new Set(view.items.map(item => item.id));
        const items = view.items.filter(item => eligible(item.type) && (receipt.items[item.id]?.signature !== item.signature || changedFocus && RULES[item.type].replayAfterCompact));
        for (const [id, mark] of Object.entries(receipt.items)) {
            // An out-of-focus item has not been removed from its source.
            if (!mark.scope || !eligible(mark.item_type))
                continue;
            if (view.focus && mark.scope.repoRoot && mark.scope.repoRoot !== view.focus.repoRoot)
                continue;
            if (!present.has(id))
                items.push(boardItem(mark.item_type, "state", mark.scope, { removed: true }));
        }
        let acknowledged = false;
        return { items, acknowledge: () => {
                if (acknowledged || items.length === 0)
                    return;
                const latest = this.load();
                for (const item of items) {
                    if (item.payload.removed)
                        delete latest.items[item.id];
                    else
                        latest.items[item.id] = { item_type: item.type, signature: item.signature, scope: item.scope };
                }
                saveSegment(this.root, this.segment(), { items: latest.items, focus });
                acknowledged = true;
            } };
    }
    afterCompact() {
        const receipt = this.load();
        for (const mark of Object.values(receipt.items))
            if (RULES[mark.item_type]?.replayAfterCompact)
                mark.signature = "";
        saveSegment(this.root, this.segment(), receipt);
    }
    clear() { try {
        unlinkSync(segmentFile(this.root, this.segment()));
    }
    catch { /* absent */ } }
}
//# sourceMappingURL=delivery.js.map
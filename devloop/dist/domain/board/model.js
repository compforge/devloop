const SCOPES = ["workspace", "repo", "component", "branch"];
export function textOf(value) { return typeof value === "string" ? value : value.text(); }
/**
 * @spec IDs are opaque; producers own identity and scope. Absence is never deletion.
 * @spec Only updates that change the full text enter the queue, in arrival order per note.
 * @see {@link component://docs/board.md}
 */
export class Board {
    entries = new Map();
    get notes() { return [...this.entries.values()].map(note => ({ ...note, queue: [...note.queue] })); }
    upsert({ id, scope, content }) {
        const previous = this.entries.get(id);
        if (previous && previous.scope !== scope)
            throw new Error(`Board note scope changed: ${id}`);
        const full = previous && typeof content !== "string" ? content.merge(previous.full) : content;
        if (previous) {
            if (textOf(full) === textOf(previous.full))
                return;
            previous.full = full;
            previous.queue.push(content);
        }
        else {
            textOf(full);
            this.entries.set(id, { id, scope, full, queue: [content] });
        }
    }
    remove(id) { this.entries.delete(id); }
    selected(ids) {
        const selected = ids === undefined ? undefined : new Set(ids);
        return SCOPES.flatMap(scope => [...this.entries.values()].filter(note => note.scope === scope && (!selected || selected.has(note.id))));
    }
    /** Scope controls grouping order, never prompt metadata or a containment hierarchy. */
    text(ids) { return this.selected(ids).map(note => textOf(note.full)).filter(Boolean).join("\n\n"); }
    /**
     * @spec Delta consumes captured queue prefixes only after all text has rendered successfully.
     * @spec Full reads never consume updates. No cursor, receipt or acknowledgment survives a delta call.
     */
    delta(ids) {
        const batch = this.selected(ids).map(note => ({ note, queue: note.queue.slice() }));
        const result = batch.flatMap(({ queue }) => queue.map(textOf)).filter(Boolean).join("\n\n");
        for (const { note, queue } of batch)
            note.queue.splice(0, queue.length);
        return result;
    }
    snapshot() {
        return { schemaVersion: 1, notes: Object.fromEntries([...this.entries].map(([id, note]) => [id, { scope: note.scope, full: textOf(note.full), queue: note.queue.map(textOf) }])) };
    }
    static restore(value) {
        const object = (entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry);
        if (!object(value) || value.schemaVersion !== 1 || !object(value.notes))
            throw new Error("Invalid Board snapshot");
        const board = new Board();
        for (const [id, note] of Object.entries(value.notes)) {
            if (!object(note) || !SCOPES.includes(note.scope) || typeof note.full !== "string"
                || !Array.isArray(note.queue) || !note.queue.every(item => typeof item === "string"))
                throw new Error(`Invalid Board note: ${id}`);
            board.entries.set(id, { id, scope: note.scope, full: note.full, queue: [...note.queue] });
        }
        return board;
    }
}
//# sourceMappingURL=model.js.map
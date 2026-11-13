export type NoteScope = "workspace" | "repo" | "component" | "branch";
export type NoteText = MergeableText | string;

export interface MergeableText {
  /** Merge this update into previous, returning a new full value without mutating either input. */
  merge(previous: MergeableText | string): MergeableText;
  /** Complete text for prompts and persistence; future merges must accept this string. */
  text(): string;
}
export interface NoteUpdate {
  readonly id: string;
  readonly scope: NoteScope;
  readonly content: NoteText;
}
export interface Note {
  readonly id: string;
  readonly scope: NoteScope;
  readonly full: NoteText;
  readonly queue: readonly NoteText[];
}
interface StoredNote { scope: NoteScope; full: string; queue: string[] }
export interface BoardSnapshot { schemaVersion: 1; notes: Record<string, StoredNote> }
interface MutableNote { id: string; scope: NoteScope; full: NoteText; queue: NoteText[] }
const SCOPES: readonly NoteScope[] = ["workspace", "repo", "component", "branch"];
export function textOf(value: NoteText): string { return typeof value === "string" ? value : value.text(); }

/**
 * @spec IDs are opaque; producers own identity and scope. Absence is never deletion.
 * @spec Only updates that change the full text enter the queue, in arrival order per note.
 * @see {@link component://docs/board.md}
 */
export class Board {
  private readonly entries = new Map<string, MutableNote>();
  get notes(): readonly Note[] { return [...this.entries.values()].map(note => ({...note, queue:[...note.queue]})); }

  upsert({id, scope, content}: NoteUpdate): void {
    const previous = this.entries.get(id);
    if (previous && previous.scope !== scope) throw new Error(`Board note scope changed: ${id}`);
    const full = previous && typeof content !== "string" ? content.merge(previous.full) : content;
    if (previous) {
      if (textOf(full) === textOf(previous.full)) return;
      previous.full = full;
      previous.queue.push(content);
    } else {
      textOf(full);
      this.entries.set(id, {id, scope, full, queue:[content]});
    }
  }
  remove(id: string): void { this.entries.delete(id); }
  private selected(ids?: Iterable<string>): MutableNote[] {
    const selected = ids === undefined ? undefined : new Set(ids);
    return SCOPES.flatMap(scope => [...this.entries.values()].filter(note => note.scope === scope && (!selected || selected.has(note.id))));
  }
  /** Scope controls grouping order, never prompt metadata or a containment hierarchy. */
  text(ids?: Iterable<string>): string { return this.selected(ids).map(note => textOf(note.full)).filter(Boolean).join("\n\n"); }
  /**
   * @spec Delta consumes captured queue prefixes only after all text has rendered successfully.
   * @spec Full reads never consume updates. No cursor, receipt or acknowledgment survives a delta call.
   */
  delta(ids?: Iterable<string>): string {
    const batch = this.selected(ids).map(note => ({note, queue:note.queue.slice()}));
    const result = batch.flatMap(({queue}) => queue.map(textOf)).filter(Boolean).join("\n\n");
    for (const {note, queue} of batch) note.queue.splice(0, queue.length);
    return result;
  }
  snapshot(): BoardSnapshot {
    return {schemaVersion:1, notes:Object.fromEntries([...this.entries].map(([id,note]) =>
      [id, {scope:note.scope, full:textOf(note.full), queue:note.queue.map(textOf)}]))};
  }
  static restore(value: unknown): Board {
    const object = (entry: unknown): entry is Record<string, unknown> => entry !== null && typeof entry === "object" && !Array.isArray(entry);
    if (!object(value) || value.schemaVersion !== 1 || !object(value.notes)) throw new Error("Invalid Board snapshot");
    const board = new Board();
    for (const [id, note] of Object.entries(value.notes)) {
      if (!object(note) || !SCOPES.includes(note.scope as NoteScope) || typeof note.full !== "string"
        || !Array.isArray(note.queue) || !note.queue.every(item => typeof item === "string")) throw new Error(`Invalid Board note: ${id}`);
      board.entries.set(id, {id, scope:note.scope as NoteScope, full:note.full, queue:[...note.queue] as string[]});
    }
    return board;
  }
}

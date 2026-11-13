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
interface StoredNote {
    scope: NoteScope;
    full: string;
    queue: string[];
}
export interface BoardSnapshot {
    schemaVersion: 1;
    notes: Record<string, StoredNote>;
}
export declare function textOf(value: NoteText): string;
/**
 * @spec IDs are opaque; producers own identity and scope. Absence is never deletion.
 * @spec Only updates that change the full text enter the queue, in arrival order per note.
 * @see {@link component://docs/board.md}
 */
export declare class Board {
    private readonly entries;
    get notes(): readonly Note[];
    upsert({ id, scope, content }: NoteUpdate): void;
    remove(id: string): void;
    private selected;
    /** Scope controls grouping order, never prompt metadata or a containment hierarchy. */
    text(ids?: Iterable<string>): string;
    /**
     * @spec Delta consumes captured queue prefixes only after all text has rendered successfully.
     * @spec Full reads never consume updates. No cursor, receipt or acknowledgment survives a delta call.
     */
    delta(ids?: Iterable<string>): string;
    snapshot(): BoardSnapshot;
    static restore(value: unknown): Board;
}
export {};
//# sourceMappingURL=model.d.ts.map
import { Board } from "./model.js";
export interface BoardSession {
    readonly harness: string;
    readonly sessionId: string;
}
/**
 * @spec Each harness/session has one Board across cwd, repo and branch changes.
 * @spec Updates and consumes reload under a process-shared lock and commit by atomic rename.
 * @why A failed read/write is not an empty Board or a successful consume.
 * @see {@link component://docs/board.md}
 */
export declare class BoardStore {
    readonly session: BoardSession;
    readonly directory: string;
    readonly path: string;
    constructor(session: BoardSession, directory?: string);
    private locked;
    transaction<T>(operation: string, run: (board: Board) => T | Promise<T>): Promise<T>;
    clear(): Promise<void>;
}
//# sourceMappingURL=store.d.ts.map
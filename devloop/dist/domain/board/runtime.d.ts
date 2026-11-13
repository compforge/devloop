import { WorkspaceContext } from "../context/workspace.js";
import { BoardStore, type BoardSession } from "./store.js";
export type PromptTrigger = "session_start" | "user_prompt";
/** Harness facade: producers select relevant IDs; the Board only merges and consumes notes. */
export declare class BoardRuntime {
    readonly root: string;
    readonly session: BoardSession;
    readonly workspace?: WorkspaceContext | undefined;
    readonly repo?: string | undefined;
    readonly staleHours?: number | undefined;
    readonly store: BoardStore;
    constructor(root: string, session: BoardSession, workspace?: WorkspaceContext | undefined, repo?: string | undefined, staleHours?: number | undefined);
    static resolve(cwd: string, sessionId?: string, harness?: string): Promise<BoardRuntime | undefined>;
    private read;
    text(): Promise<string>;
    delta(trigger?: PromptTrigger): Promise<string>;
    deliverPrompt(trigger?: PromptTrigger): Promise<string | undefined>;
    afterCompact(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=runtime.d.ts.map
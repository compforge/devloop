import { type PromptTrigger } from "./delivery.js";
import type { Board, BoardView } from "./model.js";
export declare class BoardRuntime {
    readonly root: string;
    readonly sessionId: string | undefined;
    readonly board: Board;
    readonly view: BoardView;
    readonly repo?: string | undefined;
    constructor(root: string, sessionId: string | undefined, board: Board, view: BoardView, repo?: string | undefined);
    static resolve(cwd: string, sessionId?: string): BoardRuntime | undefined;
    deliverPrompt(trigger?: PromptTrigger): string | undefined;
    snapshot(): Record<string, unknown>;
    afterCompact(): void;
    close(): void;
}
//# sourceMappingURL=runtime.d.ts.map
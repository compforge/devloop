import { type BoardDelta, type PromptTrigger } from "./delivery.js";
import type { Board, BoardView } from "./model.js";
export declare class BoardRuntime {
    readonly root: string;
    readonly sessionId: string | undefined;
    readonly board: Board;
    readonly repo?: string | undefined;
    private readonly focus;
    constructor(root: string, sessionId: string | undefined, board: Board, view: BoardView, repo?: string | undefined);
    get view(): BoardView;
    static resolve(cwd: string, sessionId?: string): Promise<BoardRuntime | undefined>;
    delta(trigger?: PromptTrigger): BoardDelta;
    full(): BoardView;
    deliverPrompt(trigger?: PromptTrigger): string | undefined;
    snapshot(): Record<string, unknown>;
    afterCompact(): void;
    close(): void;
}
//# sourceMappingURL=runtime.d.ts.map
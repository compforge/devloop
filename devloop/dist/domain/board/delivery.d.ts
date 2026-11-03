import type { BoardItem, BoardView } from "./model.js";
export type DeliveryChannel = "prompt" | "ui";
export type PromptScope = "session" | "turn";
export type PromptTrigger = "session_start" | "user_prompt";
export declare function itemsFor(view: BoardView, channel: DeliveryChannel): readonly BoardItem[];
/** Uncapped facts must remain visible when a Harness rebuilds request-local context. */
export declare function promptFactsFor(view: BoardView): readonly BoardItem[];
export declare class PromptDelivery {
    readonly root: string;
    readonly sessionId?: string | undefined;
    constructor(root: string, sessionId?: string | undefined);
    private segment;
    private load;
    deliver(view: BoardView, trigger?: PromptTrigger): string | undefined;
    /** Select and mark items once; request-local adapters retain the selection for their turn. */
    deliverItems(view: BoardView, trigger?: PromptTrigger): readonly BoardItem[];
    afterCompact(): void;
    clear(): void;
}
//# sourceMappingURL=delivery.d.ts.map
import { type BoardItem, type BoardView } from "./model.js";
export type DeliveryChannel = "prompt" | "ui";
export type PromptScope = "session" | "turn";
export type PromptTrigger = "session_start" | "user_prompt";
export declare function itemsFor(view: BoardView, channel: DeliveryChannel): readonly BoardItem[];
/** A read does not consume the delta; acknowledge only after handing its content to the host. */
export interface BoardDelta {
    readonly items: readonly BoardItem[];
    acknowledge(): void;
}
export declare class PromptDelivery {
    readonly root: string;
    readonly sessionId?: string | undefined;
    constructor(root: string, sessionId?: string | undefined);
    private segment;
    private load;
    /**
     * @spec Only new, changed or removed visible items are delivered. Elapsed time never reopens delivery.
     * @spec Inspection is read-only; acknowledgment advances only the inspected revisions.
     * @see {@link component://docs/board.md}
     */
    delta(view: BoardView, trigger?: PromptTrigger): BoardDelta;
    deliver(view: BoardView, trigger?: PromptTrigger): string | undefined;
    afterCompact(): void;
    clear(): void;
}
//# sourceMappingURL=delivery.d.ts.map
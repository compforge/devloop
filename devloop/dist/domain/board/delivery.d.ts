import type { BoardItem, BoardView } from "./model.js";
export type DeliveryChannel = "prompt" | "ui";
export type PromptScope = "session" | "turn";
export type PromptTrigger = "session_start" | "user_prompt";
export declare function itemsFor(view: BoardView, channel: DeliveryChannel): readonly BoardItem[];
export declare class PromptDelivery {
    readonly root: string;
    readonly sessionId?: string | undefined;
    constructor(root: string, sessionId?: string | undefined);
    private segment;
    private load;
    deliver(view: BoardView, trigger?: PromptTrigger): string | undefined;
    afterCompact(): void;
    clear(): void;
}
//# sourceMappingURL=delivery.d.ts.map
export type BoardItemType = "workspace" | "repo.references" | "repo.identity" | "repo.validation" | "repo.pr-blocked" | "repo.review" | "repo.review-findings" | "repo.pr-history";
export type BoardItemKind = "state" | "event" | "detail";
export interface BoardScope {
    readonly workspaceRoot: string;
    readonly repoRoot?: string;
}
export interface BoardItem {
    readonly id: string;
    readonly type: BoardItemType;
    readonly kind: BoardItemKind;
    readonly scope: BoardScope;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly signature: string;
}
export interface BoardFocus {
    readonly workspaceRoot: string;
    readonly repoRoot?: string;
}
export declare function boardItem(type: BoardItemType, kind: BoardItemKind, scope: BoardScope, payload: Record<string, unknown>): BoardItem;
export declare class BoardView {
    readonly root: string;
    readonly focus: BoardFocus | undefined;
    readonly items: readonly BoardItem[];
    constructor(root: string, focus: BoardFocus | undefined, items: readonly BoardItem[]);
    select(items: readonly BoardItem[]): BoardView;
    toJSON(): Record<string, unknown>;
}
export declare class Board {
    readonly root: string;
    readonly items: readonly BoardItem[];
    constructor(root: string, items: readonly BoardItem[]);
    view(focus?: BoardFocus): BoardView;
}
//# sourceMappingURL=model.d.ts.map
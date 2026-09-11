import { createHash } from "node:crypto";

export type BoardItemType =
  | "workspace"
  | "repo.references"
  | "repo.identity"
  | "repo.validation"
  | "repo.pr-blocked"
  | "repo.review"
  | "repo.review-findings"
  | "repo.pr-history";
export type BoardItemKind = "state" | "event" | "detail";

export interface BoardScope { readonly workspaceRoot: string; readonly repoRoot?: string }
export interface BoardItem {
  readonly id: string;
  readonly type: BoardItemType;
  readonly kind: BoardItemKind;
  readonly scope: BoardScope;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature: string;
}
export interface BoardFocus { readonly workspaceRoot: string; readonly repoRoot?: string }

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function boardItem(type: BoardItemType, kind: BoardItemKind, scope: BoardScope, payload: Record<string, unknown>): BoardItem {
  const owner = scope.repoRoot ?? scope.workspaceRoot;
  const identity = { type, kind, scope, payload };
  return {
    id: `${owner}:${type}`, type, kind, scope, payload,
    signature: createHash("sha1").update(JSON.stringify(stable(identity))).digest("hex"),
  };
}

export class BoardView {
  constructor(readonly root: string, readonly focus: BoardFocus | undefined, readonly items: readonly BoardItem[]) {}
  select(items: readonly BoardItem[]): BoardView { return new BoardView(this.root, this.focus, items); }
  toJSON(): Record<string, unknown> {
    return {
      root: this.root,
      focus: this.focus ?? null,
      items: this.items.map(({ signature: _signature, ...item }) => item),
    };
  }
}

export class Board {
  constructor(readonly root: string, readonly items: readonly BoardItem[]) {}
  view(focus?: BoardFocus): BoardView {
    const items = !focus?.repoRoot ? this.items : this.items.filter((item) => !item.scope.repoRoot || item.scope.repoRoot === focus.repoRoot);
    return new BoardView(this.root, focus, items);
  }
}

import { createHash } from "node:crypto";
function stable(value) {
    if (Array.isArray(value))
        return value.map(stable);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
    }
    return value;
}
export function boardItem(type, kind, scope, payload) {
    const owner = scope.repoRoot ?? scope.workspaceRoot;
    const identity = { type, kind, scope, payload };
    return {
        id: `${owner}:${type}`, type, kind, scope, payload,
        signature: createHash("sha1").update(JSON.stringify(stable(identity))).digest("hex"),
    };
}
export class BoardView {
    root;
    focus;
    items;
    constructor(root, focus, items) {
        this.root = root;
        this.focus = focus;
        this.items = items;
    }
    select(items) { return new BoardView(this.root, this.focus, items); }
    toJSON() {
        return {
            root: this.root,
            focus: this.focus ?? null,
            items: this.items.map(({ signature: _signature, ...item }) => item),
        };
    }
}
export class Board {
    root;
    items;
    constructor(root, items) {
        this.root = root;
        this.items = items;
    }
    view(focus) {
        const items = !focus?.repoRoot ? this.items : this.items.filter((item) => !item.scope.repoRoot || item.scope.repoRoot === focus.repoRoot);
        return new BoardView(this.root, focus, items);
    }
}
//# sourceMappingURL=model.js.map
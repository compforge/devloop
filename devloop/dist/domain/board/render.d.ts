export type FactType = "workspace" | "repo.references" | "repo.identity" | "repo.validation" | "repo.pull-request" | "repo.review";
type Row = Record<string, unknown>;
export declare function renderFact(type: FactType, payload: Readonly<Row>): string;
export {};
//# sourceMappingURL=render.d.ts.map
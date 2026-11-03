export declare const COMPLEXITIES: readonly ["simple", "medium", "complex"];
export type Complexity = typeof COMPLEXITIES[number];
export interface Classification {
    complexity: Complexity;
    confidence: number;
}
export interface ModelRef {
    providerID: string;
    id: string;
    variant?: string;
}
export type ModelRoutes = Record<Complexity, ModelRef>;
export type RoutingMode = "auto" | "auto-fast";
export interface RoutingOwnership {
    mode: RoutingMode;
    lastModel: ModelRef;
}
export declare function fastModel(ref: ModelRef): {
    variant: string;
    providerID: string;
    id: string;
};
/** @spec Pre-mode ownership records resume ordinary Auto, never opt users into Fast billing. */
export declare function routingOwnership(value: unknown): RoutingOwnership | undefined;
/** @spec Uncertain simple classifications cannot downgrade a task below the medium route. */
export declare function routeFor(answer: Classification, minimumConfidence: number): Complexity;
export declare function sameModel(left: ModelRef | undefined, right: ModelRef | undefined): boolean;
/** @spec Stored routing ownership is accepted only when it contains a complete model reference. */
export declare function modelRef(value: unknown): ModelRef | undefined;

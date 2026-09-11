/** Harness-neutral identity of a coding session. */
export interface SessionIdentity {
  readonly id: string;
  readonly cwd: string;
  readonly harness: "claude" | "codex" | "dsh";
}

/** A model-facing context item produced by the shared Board. */
export interface ContextItem {
  readonly id: string;
  readonly kind: string;
  readonly content: string;
  readonly priority: number;
}

/** Normalized tool operation understood by devloop policy. */
export type ToolOperation =
  | { readonly kind: "shell"; readonly command: string; readonly cwd: string }
  | { readonly kind: "write"; readonly path: string; readonly cwd: string }
  | { readonly kind: "other"; readonly name: string; readonly cwd: string };

/** Harness-neutral result of a pre-tool policy evaluation. */
export type ToolDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string };

/** Runtime services that every harness adapter supplies to the shared core. */
export interface RuntimePort {
  readonly session: SessionIdentity;
  log(level: "debug" | "info" | "warn" | "error", message: string): void;
}

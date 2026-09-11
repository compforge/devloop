export type Severity = "warn" | "deny";
export type TargetKind = "command" | "file_change" | "change";

export interface WorkingDirectory { readonly path?: string; readonly source: string }
export interface CommandTarget {
  readonly kind: "command";
  readonly argv: readonly string[];
  readonly workingDirectory: WorkingDirectory;
  readonly environment: readonly string[];
  readonly subcommand?: string;
  readonly args: readonly string[];
  readonly dashC?: string;
}
export interface FileChangeTarget {
  readonly kind: "file_change";
  readonly path: string;
  readonly mode: "write" | "edit";
  readonly toolInput?: Readonly<Record<string, unknown>>;
}
export type Target = CommandTarget | FileChangeTarget;
export interface Change { readonly targets: readonly Target[]; readonly cwd: string; readonly tool: string; readonly command: string }
export interface Finding { readonly rule: string; readonly severity: Severity; readonly message: string; readonly locator?: string }
export interface Decision { readonly action: "allow" | "warn" | "deny"; readonly findings: readonly Finding[] }

export function decision(findings: readonly Finding[]): Decision {
  return { action: findings.some((item) => item.severity === "deny") ? "deny" : findings.some((item) => item.severity === "warn") ? "warn" : "allow", findings };
}
export function decisionMessage(value: Decision): string {
  const severity = value.action === "deny" ? "deny" : "warn";
  return value.findings.filter((item) => item.severity === severity).map((item) => item.message).join("\n\n");
}

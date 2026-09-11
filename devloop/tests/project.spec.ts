import { describe, expect, it } from "vitest";
import { projectTool } from "../hooks/core/project.js";

describe("projectTool", () => {
  it("projects commands with scoped cd and git -C", () => {
    const change = projectTool({
      harness: "claude", toolName: "Bash", cwd: "/workspace",
      toolInput: { command: "cd a && git -C nested commit -m x; make test" },
    });
    expect(change.targets).toMatchObject([
      { kind: "command", subcommand: "commit", args: ["-m", "x"], workingDirectory: { path: "/workspace/a/nested" } },
      { kind: "command", argv: ["make", "test"], args: ["test"], workingDirectory: { path: "/workspace/a" } },
    ]);
  });

  it("projects every apply_patch target", () => {
    const change = projectTool({
      harness: "codex", toolName: "apply_patch", cwd: "/workspace",
      toolInput: { patch: "*** Begin Patch\n*** Add File: a.ts\n*** Update File: b.ts\n*** End Patch" },
    });
    expect(change.targets).toEqual([
      { kind: "file_change", path: "a.ts", mode: "write" },
      { kind: "file_change", path: "b.ts", mode: "edit" },
    ]);
  });

  it("projects native DSH bash and editor tools", () => {
    expect(projectTool({
      harness: "dsh", toolName: "bash", cwd: "/workspace", toolInput: { command: "git add ." },
    }).targets[0]).toMatchObject({ kind: "command", subcommand: "add" });
    expect(projectTool({
      harness: "dsh", toolName: "str_replace_editor", cwd: "/workspace",
      toolInput: { command: "str_replace", path: "/workspace/a.ts" },
    }).targets[0]).toMatchObject({ kind: "file_change", path: "/workspace/a.ts", mode: "edit" });
  });

  it("unwraps shell launchers before applying command policy", () => {
    for (const command of ['bash -lc "git add -A"', "env FOO=1 git add --all", "command git add ."]) {
      const change = projectTool({ harness: "codex", toolName: "Bash", cwd: "/workspace", toolInput: { command } });
      expect(change.targets[0]).toMatchObject({ kind: "command", subcommand: "add" });
    }
  });

  it("preserves shell scope for subshells, substitutions, pipes, and generic -C", () => {
    const targets = projectTool({
      harness: "claude", toolName: "Bash", cwd: "/workspace",
      toolInput: { command: "(cd child && git push); git status | echo $(git commit -m x); go -C /repo test ./..." },
    }).targets;
    expect(targets).toMatchObject([
      { kind: "command", subcommand: "push", workingDirectory: { path: "/workspace/child" } },
      { kind: "command", subcommand: "status", workingDirectory: { path: "/workspace" } },
      { kind: "command", subcommand: "commit", workingDirectory: { path: "/workspace" } },
      { kind: "command", argv: ["echo", "$", "git", "commit", "-m", "x"] },
      { kind: "command", argv: ["go", "-C", "/repo", "test", "./..."], workingDirectory: { path: "/repo" } },
    ]);
  });
});

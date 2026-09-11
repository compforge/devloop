# Harness adapter

devloop 的共享运行时使用 TypeScript。Claude Code、Codex 与 DeepSeek Harness 只在事件输入和输出协议上分化，领域模型与规则不随 CLI 复制。

```text
Claude/Codex hook payload ─┐
                           ├─ adapter ─> HarnessToolInput ─> projectTool ─> Change
DSH Cordis ToolExecution ──┘                                      │
                                                                  v
Board / state store <──────────────────────────────────── PolicyContext
                                                                  │
                                                                  v
                                           Decision ─> harness-specific output
```

## 稳定边界

- `domain/`：Workspace、Repo、Component、Board、session/state 与 forge 中立模型。
- `hooks/core/`、`hooks/rules/`：工具投影、策略上下文、规则评估和 Decision。
- `adapters/claude.ts`、`adapters/codex.ts`：stdin/stdout hook dialect。
- `adapters/dsh.ts`：原生 Cordis plugin，导出 `name`、`inject`、`apply`，直接监听 DSH lifecycle/tool events。
- `scripts/*.py`：由 skill 调用的 Git、release、validation、review 工作流。它们是跨 Harness 的 CLI 编排入口，可以继续使用 Python，但不得新增另一份 Board 或 policy 语义。

## 事件映射

| Shared behavior | Claude Code / Codex | DSH Cordis |
|---|---|---|
| Session Board seed | `SessionStart` | `agent/session-start` |
| Turn Board delivery | `UserPromptSubmit` | `agent/pre-step` |
| Tool admission | `PreToolUse` | `tools/pre-execute` |
| Git/session activity | `PostToolUse` | shared tool projection; lifecycle extension |
| Compact replay | `PostCompact` / compact start | `agent/session-start` with `compact` |
| Session cleanup | `SessionEnd` | `agent/disposed` |

Adapter 应 fail-open：协议解析或本地派生状态失败不能卡死 Harness。明确命中的 deny 则由共享 Decision 原样翻译为各端的阻断结果。

## 构建与验证

```console
npm --prefix devloop run check
npm --prefix devloop run build
```

Git marketplace 直接执行已提交的 `dist/hooks/runtime.js`；npm 消费方通过 package exports 加载 `@compforge/devloop` 或 `@compforge/devloop/dsh`。

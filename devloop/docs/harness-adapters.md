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
- `scripts/`：由 skill 调用的 Git、release、validation、review Python workflow，包含其私有辅助包；Harness runtime 不得导入该子树，也不得在其中新增另一份 Board 或 policy 语义。

Claude/Codex 作为已安装 CLI plugin 时，使用官方 manifest 与 command hooks 即是原生接入；`@anthropic-ai/claude-agent-sdk` 和 `@openai/codex-sdk` 面向“应用内创建/控制 agent session”，不是 plugin hook 的运行时依赖。只有以后提供 embedded-agent adapter 或 SDK 级集成测试时才引入。

## 事件映射

| Shared behavior | Claude Code / Codex | DSH Cordis |
|---|---|---|
| Session Board seed | `SessionStart` | `agent/session-start` |
| Turn Board delivery | `UserPromptSubmit` | `agent/pre-step` |
| Tool admission | `PreToolUse` | `tools/pre-execute` |
| Git/session activity | `PostToolUse` | shared tool projection; lifecycle extension |
| Compact replay | `PostCompact` / compact start | `agent/session-start` with `compact` |
| Session cleanup | `SessionEnd` | `agent/disposed` |

Adapter 应 fail-open：协议解析或本地派生状态失败不能卡死 Harness。明确命中的 deny 由共享 Decision 翻译为各端阻断结果；command hook 超时、缺失或 Harness 未覆盖路径仍可能放行，因此这些规则是工作流护栏，不是完整安全边界。DSH 的进程内 Cordis 决策可提供更强的一致性，但也复用同一 fail-open policy core。

## 构建与验证

```console
npm --prefix devloop run check
npm --prefix devloop run build
```

Git marketplace 直接执行已提交的 `dist/hooks/runtime.js`；npm 消费方通过 package exports 加载 `@compforge/devloop` 或 `@compforge/devloop/dsh`。

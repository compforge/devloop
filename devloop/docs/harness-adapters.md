# Harness adapter

devloop 的共享运行时使用 TypeScript。Claude Code、Codex、DeepSeek Harness 与 OpenCode V2 只在事件输入和输出协议上分化，领域模型与规则不随 CLI 复制。

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
- `adapters/dsh.ts`：原生 Cordis plugin，导出 `name`、`inject`、`Config`、`apply`，直接监听 DSH lifecycle/tool events。
- `cordis.patch.yml`：可安装 DSH bundle layer；profile 安装包后由 `dsh.bundle.patch` 自动挂载 adapter。
- `scripts/`：由 skill 调用的 Git、release、validation、review Python workflow，包含其私有辅助包；Harness runtime 不得导入该子树，也不得在其中新增另一份 Board 或 policy 语义。

Claude/Codex 作为已安装 CLI plugin 时，使用官方 manifest 与 command hooks 即是原生接入；`@anthropic-ai/claude-agent-sdk` 和 `@openai/codex-sdk` 面向“应用内创建/控制 agent session”，不是 plugin hook 的运行时依赖。只有以后提供 embedded-agent adapter 或 SDK 级集成测试时才引入。

## 事件映射

| Shared behavior | Claude Code / Codex | DSH Cordis |
|---|---|---|
| Session Board seed | `SessionStart` | `agent/created` |
| Turn Board delivery | `UserPromptSubmit` | `agent/pre-step` |
| Tool admission | `PreToolUse` | `tools/pre-execute` |
| Git/session activity | `PostToolUse` | shared tool projection; lifecycle extension |
| Compact replay | `PostCompact` / compact start | `agent/created` with `compact` |
| Session cleanup | `SessionEnd` | `agent/disposed` |

工具调用记录必须按 Harness 的结果协议判断失败：Claude 使用 `PostToolUseFailure`，Codex 的
`PostToolUse` 也包含非零退出的执行。Codex adapter 从 shell / unified-exec 的结果头读取退出码，
从 MCP `CallToolResult.isError` 读取工具错误；不根据命令输出正文中的错误字样判断，也不把输出
正文写入工具调用账本。没有这些失败信号的完成事件保持原有记录语义。

Adapter 应 fail-open：协议解析或本地派生状态失败不能卡死 Harness。明确命中的 deny 由共享 Decision 翻译为各端阻断结果；command hook 超时、缺失或 Harness 未覆盖路径仍可能放行，因此这些规则是工作流护栏，不是完整安全边界。DSH 的进程内 Cordis 决策可提供更强的一致性，但也复用同一 fail-open policy core。

## 会话活动触发对账

Codex 的 SessionStart 与 PostToolUse 在实际访问的 repo 上非阻塞启动共享的一次性 task CLI。
触发器只负责按主 checkout 节流和识别仍在运行的任务；Forge 查询、清理规则与执行结果仍由 task 拥有。
该进程边界不参与 Board 或 admission 的同步决策，Python 启动失败也不改变 hook 输出。
多个 worktree 共用主仓触发记录，单仓心跳不扩大到所属 workspace 的其它仓库。

最近一次执行的 stdout/stderr 保存在主仓 `.devloop/tmp/pr-lifecycle-reconcile.log`，
启动失败记录在 `.devloop/tasks.jsonl`；任务报告中的 refresh failure 与 deferred action 返回非零退出码。
会话活动触发不保证空闲时运行，持续调度仍由 Claude monitor 或用户配置的 Scheduled task 提供。

## 构建与验证

```console
npm --prefix devloop run check
npm --prefix devloop run build
```

构建先生成公共 ESM/types，再将进程 hook 与其 repocli 依赖打包到 `dist/hooks/runtime.js`。
Git marketplace 直接执行这个已提交产物，不要求安装 `node_modules`，运行时不下载依赖；npm 消费方通过 package exports 加载 `@compforge/devloop` 或 `@compforge/devloop/dsh`，DSH profile 通过包内声明的 bundle layer 自动加载后者。

原生仓库识别是异步操作，`inspectCatalog`、`defaultComponent`、`discoverComponents`、
`resolveRepo`、`BoardRuntime.resolve` 和 `evaluateTool` 返回 Promise，调用方必须等待结果。
`owningComponent` / `enclosingComponent` 接受显式 `ComponentCatalog`，只做同步投影。
PolicyContext 在一次评估内复用识别；新事件创建新上下文。识别失败仍按规则的 fail-open /
fail-closed 策略产生 warning / deny，Board 保留 Git/review 状态并显示识别缺口。

## OpenCode V2

`adapters/opencode.ts` default-exports the native V2 definition; npm `./server` and the local
`server.js` entrypoint load it without changing the public library entrypoint. The supported
baseline is `@opencode/plugin` / OpenCode `2.1.2`; V1 hooks are a different protocol.

- `skill.transform` registers the bundled Markdown assets with namespaced IDs, real file paths,
  and resolved `<PLUGIN_ROOT>` paths. YAML frontmatter is parsed once during setup.
- `session.prompt` starts a new Board delivery window. The first primary `context` hook selects
  due turn items through the shared receipt policy; subsequent requests retain that selection
  and render current payloads. Uncapped facts (workspace/references, repo identity, and validation)
  remain visible in every request. This is request-local context, not durable chat history. Compaction resets replayable delivery marks.
- Tool admission uses the session's current location/subpath, not the plugin's loading location.
  Native `shell`, `edit`, `write`, and `patch(patchText)` project to shared policy. CodeMode child
  calls pass through the same hooks. Explicit deny throws a tool error outside the fail-open catch.
- The native shell executor is wrapped with invocation-local AsyncLocalStorage. `shell.create.before`
  supplies `DEVLOOP_HARNESS=opencode`, `DEVLOOP_SESSION_ID`, and `PLUGIN_ROOT` to that child only.
  TypeScript and Python identity readers honor this explicit pair before inherited Harness variables.
- `execute.after` distinguishes native errors from completed shells with nonzero `output.exit`,
  timeout or signal. CodeMode `execute` results with `output.error=true` are failures even when
  the outer native event is completed. Invocation-local ledger IDs distinguish CodeMode children
  that share the Harness call ID. A background shell's `running` return stays a start record,
  not success evidence;
  this adapter does not currently reconcile its later terminal result into the timing ledger.
- Execution terminal events release touched checkout owners without clearing Board reminder budgets.
  Session deletion and plugin unload clear session state and ownership. Restored sessions initialize
  lazily on their first observed request or tool. Activity runs the existing bounded reconciliation;
  no idle-time scheduler or background polling loop is installed.

Regression cases live in `tests/opencode.spec.ts`; live host checks must additionally cover the
Promise/Effect bridge, native tool denial, CodeMode child calls, and model-visible context.

Run `make test-opencode` for the opt-in installed-host integration test. Override
`DEVLOOP_OPENCODE_BIN` when the executable is not on PATH. The fixture uses isolated config/state,
a local scripted HTTP model (no provider credentials or paid model calls), native CodeMode child
tools, and the real Python launcher. Its temporary evidence directory contains `summary.json`
and the native server log; ordinary `make test` does not require an installed OpenCode CLI.

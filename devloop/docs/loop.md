# devloop 一轮循环 — 端到端流程

把分散在 AGENTS.md（架构）与 CONCEPTS.md（术语）里的三条流程线——repo 解析、分支四态、owner 锁——放回同一条时间轴上看。术语定义一律以 CONCEPTS.md 为准，本文不复述。

---

## 1. 理念

开发者在聚合工作区里转一个循环：

```
enter 某子模块 → 提需求 → 开发 → 验证(lint/test) → commit/建 PR → 人工 merge → 下一轮
```

devloop 的两个杠杆沿循环分布：**状态源 + Board**（软提示）覆盖循环的每一拍——状态源提供事实，Board 决定如何组织和投递，AI 动手前就知道相关现状；**硬拦截**只立在"没有合法例外"的位置——保护分支、失活分支、guest 共写。workspace 是循环的根（session cwd 常驻于此），subproject 是每一拍动手的落点——所以贯穿全文的一个不变量是：**任何组件都不能信 shell cwd，要按有效落点解析 repo**。

---

## 2. 流程：一轮循环的时序

每拍列出：触发事件 → 参与的 hook / script → 碰了哪类状态。

| # | 拍 | 触发 | 参与者 | 状态效果 |
|---|----|------|--------|---------|
| 0 | session 启动 | `SessionStart` | TS `initializeBoard` | 状态预热；Board 投递 session items（References / subprojects）；注册全部 subproject 的 AGENTS.md `watchPaths`；workspace 自动注册 |
| 1 | enter 子模块 | `cd` → `CwdChanged` | TS `afterCwdChanged` | 刷新 repo 段状态；记 `active.json`（不占有 owner 锁——enter 只选上下文） |
| 2 | 每轮对话 | `UserPromptSubmit` | TS `userPromptOutput` | Board 按相关性投递变化/到期的 session/turn/event items，ui_only 不进入 prompt；`PostCompact` 只令状态 items 重放；AGENTS.md 被改时 `FileChanged` → TS `afterFileChanged` 刷新事实 |
| 2b | 开始新工作 | 新任务需要独立 branch | `scripts/branch.py create` | 刷新 `origin/<target>`；clean checkout 上创建 branch、由 RepoKit 记录创建来源，devloop 占有 owner 锁；外来 owner 引导 managed worktree |
| 3 | 开发（编辑与命令） | `PreToolUse` | TS `recordToolCall` 记录原始调用；策略引擎规则处理编辑面（owner / branch merged / requirements）与命令面（保护分支 / checkout owner / worktree add / add-all / workspace cwd / pytest / pip） | 最近一小时的调用起点追加到 repo 的 `.devloop/tool-calls.jsonl`；策略 deny 或放行，全部 fail-open |
| 3' | 开发后效 | `PostToolUse` / `PostToolUseFailure` | TS `recordToolCall`；TS `afterTool` | 时间线追加完成结果并滚动清理；git 状态命令后按**位置感知的有效目录**刷新对应 repo 的 branch 段。时间线不参与验证；检查执行与复用由 repocli 管理 |
| 4 | 验证 | AI 按 validate skill 显式执行 | `repocli validate` → `format → lint ‖ test` | repocli 保存各 check 的结果与复用历史 |
| 5 | 提交 / PR | `/gcam` `/gcamp` `/gcampr` | `commit_flow`（PLAN banner 自陈） | 复用 `domain.branch` 承载兼容的 edit-then-cut；可重复的 `--file` 收敛 staging；外来提交自检；AI 直接调用 repocli 创建或更新 PR，并检查 review 状态 |
| 5b | 在途 PR/MR rebase | `smart_rebase.sh start/continue/finish` | `scripts/domain/rebase.py`（worktree-local transaction） | start 在改写前保存远端 source SHA；finish 用精确 `force-with-lease`，远端移动即拒绝覆盖 |
| 6 | 等人工 merge | Board / 写入 gate 按需查询 | 原生 RepoKit PR context | 当前分支派生为 in-flight，Board turn item 软提示 |
| 7 | PR/MR 终态后的下一轮 | 查询到 Forge 状态变为 merged / closed | 原生查询；PR 写入或显式 clean 时维护资源 | 分支派生为 inactive；RepoKit 按 merged 状态和数量策略维护 linked worktree（保护本地工作、保留 branch ref），回到第 1 拍，从最新 `origin/<target>` 切新分支 |

### 分支一轮的生命线

```
cut off origin/<target> → healthy ──push+PR──▶ in-flight ──人工 merge(AI 范围外)──▶ inactive
         ▲                                                                            │
         └──────────────────  下一轮：再 cut off origin/<target>  ◀───────────────────┘
```

四态定义与软提示 / 硬拦的分档理由见 CONCEPTS.md〈分支状态流转〉。

### 三条贯穿线

- **repo 解析链**（拍 1 / 3 / 4 / 5 都用）：显式 `--repo` → cwd 所在仓库 → `active.json` 最近活跃仓；guard 侧按命令段的有效执行目录（`-C` > cd 前缀 > cwd）归属。见 CONCEPTS.md〈脚本的 repo 解析〉。
- **tool-call 时间线**（拍 3 / 3'）：devloop 只记录原始 tool 名、阶段、结果与时间，不解释 read/write；外部 loop 在最近一小时窗口上自行归类和决策。追加与压缩共用短锁，避免原子替换吞掉并发写入。
- **分支四态**（拍 2 的提示内容、拍 3 / 5 的拦截依据）：protected / healthy / in-flight / inactive，全部由 repocli 查询结果派生、不存 bool。见 CONCEPTS.md〈分支状态流转〉。
- **owner 锁**（拍 3 / 3' 第一笔变更动作 acquire + enforce）：第一个动手的 session 占有 checkout，guest 的切分支与编辑被拦、引导 worktree；enter / 只读不占有。见 CONCEPTS.md〈Owner / guest session〉。

---

## 3. 关键设计（流程级 why）

- **为什么 merge 留在 AI 范围外**：merge 是发布权，留给人是边界设计而非能力缺口；devloop 只保证 merge 前的一切（验证报告、PLAN 自陈、外来提交自检）可审计。
- **验证时机由 skill 提醒**：AI 在提交或提交 PR 前直接执行 repocli validate，并报告范围和结果；提交脚本不运行验证、不读取验证门禁。
- **为什么循环里到处是"派生不存 bool"**：拍 6/7 的状态翻转发生在 AI 范围外（人工 merge），任何落盘的 bool 都会过期；按 repocli 查询结果现算，切分支即自动失效、无人去清。
- **资源维护归 RepoKit**：原生 PR 写操作和显式 clean 复用当前 PR 观察与保护规则。devloop 不注册周期清理，也不在 Harness 活动时扫描仓库。
- **为什么 guard 全部 fail-open**：循环的主产出是开发本身，guard 是护栏不是闸门——任何 guard 内部错误都不得打断用户的工具调用（`hook_io` runner 保证）。命令侧守卫同理采用风险黑名单而非白名单：宁可放过少数未知风险，也不因无法穷举命令生态而误拦正常操作。

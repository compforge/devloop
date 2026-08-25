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
| 0 | session 启动 | `SessionStart` | `sessionstart_init` | 状态预热；Board 投递 session items（References / subprojects）；注册全部 subproject 的 AGENTS.md `watchPaths`；workspace 自动注册 |
| 1 | enter 子模块 | `cd` → `CwdChanged` | `cwdchanged_enter` | 刷新 repo 段状态；记 `active.json`（不占有 owner 锁——enter 只选上下文） |
| 2 | 每轮对话 | `UserPromptSubmit` | `userprompt_inject` | Board 按相关性投递变化/到期的 session/turn/event items，ui_only 不进入 prompt；`PostCompact` 只令状态 items 重放；AGENTS.md 被改时 `FileChanged` → `filechanged_refs` 刷新事实 |
| 2b | 开始新工作 | 新任务需要独立 branch | `branch.py create` → `domain.branch` | 刷新 `origin/<target>`；clean checkout 上创建 branch、记录 `fork_from` 并占有 owner 锁；外来 owner 引导 managed worktree |
| 3 | 开发（编辑与命令） | `PreToolUse` | `tool_call_timeline` 记录原始调用；策略引擎规则处理编辑面（owner / branch merged / requirements）与命令面（保护分支 / checkout owner / worktree add / add-all / workspace cwd / pytest / pip / precommit gate） | 最近一小时的调用起点追加到 repo 的 `.devloop/tool-calls.jsonl`；策略 deny 或放行，全部 fail-open |
| 3' | 开发后效 | `PostToolUse` / `PostToolUseFailure` | `tool_call_timeline`；`posttool_git_refresh` | 时间线追加完成结果并滚动清理；git 状态命令后按**位置感知的有效目录**刷新对应 repo 的 branch 段。时间线不参与 validation gate，验证是否过期仍由内容指纹判定 |
| 4 | 验证 | validate skill / lifecycle gate | `run_validate` → `normalize → lint ‖ test` | 按 component 记录各 check 结果（lint 内容指纹 + test 时间） |
| 5 | 提交 / PR | `/gcam` `/gcamp` `/gcampr` | `commit_flow`（PLAN banner 自陈） | 复用 `domain.branch` 承载兼容的 edit-then-cut；可重复的 `--file` 收敛 staging；外来提交自检；建 PR 后触发一次 `poll_pr_status` |
| 5b | 在途 PR/MR rebase | `smart_rebase.sh start/continue/finish` | `domain.rebase`（worktree-local transaction） | start 在改写前保存远端 source SHA；finish 用精确 `force-with-lease`，远端移动即拒绝覆盖 |
| 6 | 等人工 merge | Claude monitor / Codex Scheduled task | `run_task pr-lifecycle-reconcile` | 写当前分支 `pr.json` 与全 local branch `local_pull_requests.json`；当前分支派生为 in-flight，Board turn item 软提示 |
| 7 | merge 后下一轮 | Forge 状态变为 merged | `pull_request_lifecycle` | 分支派生为 inactive；干净、无人使用的 managed worktree 被回收（branch ref 保留），其余延后重试；回到第 1 拍，从最新 `origin/<target>` 切新分支 |

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
- **分支四态**（拍 2 的提示内容、拍 3 / 5 的拦截依据）：protected / healthy / in-flight / inactive，全部由 `pr.json` 窗口派生、不存 bool。见 CONCEPTS.md〈分支状态流转〉。
- **owner 锁**（拍 3 / 3' 第一笔变更动作 acquire + enforce）：第一个动手的 session 占有 checkout，guest 的切分支与编辑被拦、引导 worktree；enter / 只读不占有。见 CONCEPTS.md〈Owner / guest session〉。

---

## 3. 关键设计（流程级 why）

- **为什么 merge 留在 AI 范围外**：merge 是发布权，留给人是边界设计而非能力缺口；devloop 只保证 merge 前的一切（验证戳、PLAN 自陈、外来提交自检）可审计。
- **为什么验证不是 commit 的强制前置**：lint/test 状态走软提示 + validation 戳，强制 gate 是 opt-in（`precommit_gate`，默认关）——"未验证就提交"有合法场景（docs、紧急 hotfix），硬拦会逼出逃逸口。与 in-flight 软提示同一个分档准则：有合法例外的用提示，没有的才硬拦。
- **为什么循环里到处是"派生不存 bool"**：拍 6/7 的状态翻转发生在 AI 范围外（人工 merge），任何落盘的 bool 都会过期；按 `pr.json` 窗口现算，切分支即自动失效、无人去清。
- **为什么回收是 reconciliation 而非 transition handler**：周期触发器可能离线或重启，边沿事件并不可靠。每轮用 Forge 当前状态对账本地 branch / checkout，动作保持幂等；漏过 merge 瞬间也会在下一次完整快照后补做。task 定义与单次执行唯一，Claude monitor 和 Codex Scheduled task 只是循环 / 调度 adapter。
- **为什么 guard 全部 fail-open**：循环的主产出是开发本身，guard 是护栏不是闸门——任何 guard 内部错误都不得打断用户的工具调用（`hook_io` runner 保证）。命令侧守卫同理采用风险黑名单而非白名单：宁可放过少数未知风险，也不因无法穷举命令生态而误拦正常操作。

# devloop plugin — 设计与开发指南

面向二次开发者。使用向（装 / 配 / 跑）见 [`README.md`](./README.md)；共享术语见 [`CONCEPTS.md`](./CONCEPTS.md)。

---

## 项目定位与边界

**devloop 的领域职责是管理 PR/MR 的创建、开发与验证生命周期**：

```
enter repo → 基于 branch 开发 → 按 Component 验证 → commit / push → 创建 PR/MR → 人工 merge
```

**领域主链是 `PR/MR → Repo → Component`**：PR/MR 始终锚定一个 repo；repo 是 git、branch、forge 状态和提交历史的边界；component 是 repo 内 build/lint/test 的验证单位。Branch 是开发生命周期主轴；面向多 session 并发时，worktree 是 branch 的一种特殊形态。

**Workspace 是运行上下文，不是 PR/MR 的归属边界**：它可以聚合多个 repo，为项目知识和多 session 协作提供共同根；单仓库模式同样完整支持。跨 repo Requirement 与长期编排由 Baton/reqloop 拥有，devloop 不维护需求状态机。

**目录按 owner 表达这个模型**：`domain/` 承载 Workspace / Repo / Component、branch/PR 状态、生命周期规则及合法变化；`lib/` 提供 Git、forge、ecosystem、config、parser 等技术能力；`hooks/` 与 `scripts/` 是事件和工作流两类驱动 adapter。入口只向 `domain/lib` 调用，两层都不反向依赖入口，让 LLM 对 workspace/repo 的作用落在可观测、可约束的路径上，而不是散落 shell 副作用。

AGENTS.md 是项目边界与 References 的**文字知识源**；`.devloop/*.json` 是由 hooks、scripts、monitors 从 git、forge、验证命令和文字源派生的**结构化运行态**。Board 在两者之上组织当前 session 相关的紧凑视图并投递给 prompt。三者共同服务于同一个目标：让 LLM 对 workspace/repo 的作用可控、可观测、可验证。一轮循环的端到端时序见 [`docs/loop.md`](./docs/loop.md)。

**两个控制杠杆**：

1. **Board 消除信息滞后**：状态源持续提供当前 subproject 的 branch / 工作区 / PR / validation，加上 workspace 级的子项目清单与 AGENTS.md References；Board 按相关性组织 payload-first 条目，以独立的 item kind、delivery channel、prompt scope 与 replay policy 决定投递——AI 改第一行前就掌握现状，长历史又不浪费 prompt token。
2. **硬拦截把软约定变成执行级边界**：PreToolUse `deny`，AI 绕不过（保护分支、过期分支改文件、误带文件…）。

**实现取向**：native-first——控制能力优先坐到 CLI 原生事件和统一技术 seam 上；独立 `.devloop/` 命名空间，状态与其它工具互不干扰。Lifecycle hook 尽量两端共用；周期开发任务定义为单次可发现 task，Claude monitor 与 Codex Scheduled task 只分化接入方式。

**边界**：
- 聚合 workspace 与单 repo 都是运行形态，workspace 可选；子项目从文件系统发现，手工 init 不是前置。
- 只管 PR/MR 生命周期内的 repo/branch、开发入口和验证控制；**不做**问题发现与 trace、部署、通用 git 教学。
- 当前支持 **Claude Code + Codex**。两端共用 `SessionEnd` 释放路径；Claude 保留 CwdChanged / FileChanged，Codex 用 `posttool_codex_refresh.py` 补刷新缺口。周期 PR/MR 对账由 `tasks/tasks.json` 唯一发现，Claude native monitor 循环运行，Codex Scheduled task 单次运行。opencode 仍待协议明确。

---

## 代码地图与核心模块

```
devloop/
├── .claude-plugin/plugin.json     # Claude manifest（靠目录约定自动发现）
├── domain/                         # 领域 owner：模型、状态变化与生命周期规则
│   ├── repo.py                    #   ★Repo 模型 + cwd 无关解析 + WorkSet（本轮 components）
│   ├── branch.py                  #   ★Branch 创建事务：fresh base / owner / dirty carry / fork_from
│   ├── workspace.py               #   ★Workspace 注册、发现与归属
│   ├── repo_layout.py             #   ★Component 模型 + repo/component 路径边界
│   ├── context/                   #   ★状态源：repo/workspace/session、gate/prstate
│   ├── board/                     #   ★Board：结构化模型/投影/view + delivery policy/receipt/renderer
│   ├── lifecycle/                 #   ★pre/post commit/MR dispatch + lint/test/review handlers
│   ├── forge.py                   #   ★PullRequest/Comment/Release 中立模型 + Forge port
│   ├── pull_request_lifecycle.py  #   ★本地 branch / checkout ↔ PR/MR desired-state reconciliation
│   ├── review_feedback.py         #   review finding/label 的领域 join
│   ├── worktree.py                #   branch 隔离 checkout 的创建/复用、依赖准备与清理
│   └── rebase.py                  #   已有 MR 分支的可恢复 rebase + 精确 SHA lease 发布
├── lib/                            # 技术能力：被 domain/hooks/scripts 消费
│   ├── gitcmd.py  git_state.py    #   ★统一 git runner 与 git/branch/worktree 事实
│   ├── forge/                     #   ★GitHub/GitLab 平级 adapter + HTTP/按 repo 分发
│   ├── ecosystem/                 #   ★工具链身份、环境准备与 canonical fallback
│   └── config.py  parsers.py      #   ★配置持久化与文字源解析
├── hooks/                          # 事件驱动 adapter：把 LLM/CLI 工具调用投影成领域决策
│   ├── hooks.json                 # Claude 事件注册
│   ├── hooks.codex.json           # Codex 事件注册（含 SessionEnd + PostToolUse 刷新）
│   ├── hook_io.py                 # hook payload/output harness
│   ├── core/  rules/              # Change→Target→Rule→Decision 引擎与规则
│   ├── cmdtree/  codemodel/       # Bash/FileChange 投影，只服务 hook policy
│   ├── friction.py                # guard deny → friction ledger adapter
│   ├── cwdchanged_enter.py        # Claude CwdChanged：自动 enter
│   ├── posttool_codex_refresh.py  # Codex PostToolUse：补 cwd/state 刷新
│   ├── sessionstart_init.py       # SessionStart：预热事实 + Board session items + watchPaths
│   ├── userprompt_inject.py       # UserPromptSubmit：投递 Board 到期/变化条目
│   ├── postcompact_reinject.py    # PostCompact：让 Board 重放状态条目
│   ├── filechanged_refs.py        # FileChanged：刷新 AGENTS.md 事实
│   ├── posttool_git_refresh.py       # PostToolUse：git 状态命令后刷新 branch 段
│   ├── sessionend_release.py      # SessionEnd：释放本 session 的 owner 锁（正常退出路径）
│   └── pretool_*.py               # 命令/编辑硬拦截（guard harness；含 owner 锁与裸 worktree add 拦截）
├── tasks/                          # ★共享 task 发现 + 单次执行（PR/MR observation/reconciliation）
├── scripts/                        # 工作流驱动 adapter：含通用 run_task + git / validation / review 入口
├── monitors/monitors.json          # Claude native-monitor adapter：循环调用共享 task
├── commands/                       # slash：enter / gcam / gcamp / gcampr（validation 归 skill，gate 自动触发）
├── skills/                         # git-ops / gcam* / validate / review + Codex Scheduled-task adapter
└── config/                         # config.example.json 模板；全局配置在 ~/.devloop/config.json，repo/workspace 可在 .devloop/config.json 就近覆盖
```

---

## 关键约定

1. **领域归属沿 `PR/MR → Repo → Component`**：PR/MR 与 branch 生命周期归 Repo，验证范围与验证结果归 Component；Workspace 只聚合上下文。不得重新引入“一个 repo 只有一个代码目录”的假设，具体选择与身份语义见 [`CONCEPTS.md`](./CONCEPTS.md)。
2. **入口驱动领域，依赖不反向**：`hooks/scripts → domain/lib`；`domain/` 持有业务事实和合法变化，`lib/` 只提供 Git、forge、配置等技术能力。Git、forge、配置分别经统一 seam，入口不得散调外部协议或复制领域判断。
3. **状态源提供事实，Board 决定组织和投递，guard 读取 live truth**：AGENTS.md 是文字知识源，`.devloop/` 是结构化运行态；Repo、Branch、WorkingTree 与 Session 状态按归属和写入者隔离，验证戳按 Component 记录。Board 只维护 per-session 投递游标，不复制业务事实，也不参与硬门禁判定。详见 [`docs/board.md`](./docs/board.md) 与 [`CONCEPTS.md`](./CONCEPTS.md)。
4. **生命周期动作走唯一入口，合法例外才软提示**：新工作在编辑前走 `branch.py create`，branch 创建规则归 `domain.branch`；commit/push/PR 走 `commit_flow`/smart 脚本并复用同一 branch 事务；checkout 选择及 worktree 形态的创建、复用和清理走 `checkout.py` / `domain.worktree`，PR/MR 状态到 checkout 动作的映射归 `pull_request_lifecycle`。保护分支、失活分支、guest session 等无合法编辑路径的情况硬拦截，有合法例外的 in-flight PR/MR 只注入提示。具体流程见 [`docs/loop.md`](./docs/loop.md) 与 [`docs/lifecycle-hooks.md`](./docs/lifecycle-hooks.md)。
5. **devloop 产出开发事实，不拥有长期业务 loop 或会话唤醒**：task 可维护结构化状态，并对 devloop 自有本地资源执行有界、幂等的 desired-state reconciliation；Harness monitor / scheduler 只重复触发它。跨系统持久观察、调度和后续工作仍归 Baton/reqloop；不要在 Plugin 内重建通知 transport、waiter 或 re-arm 流程。

---

## References

- 一轮循环端到端流程（事件 → hook/script → 状态）：[`docs/loop.md`](./docs/loop.md)
- Board 上下文读模型（事实源 → Board/View → channel/scope/replay policy）：[`docs/board.md`](./docs/board.md)
- devops 生命周期 hook（pre_commit/post_commit/pre_mr/post_mr，统一 lint/test/review 等的触发；hook 皆阻塞，异步结果写结构化状态供下一轮或外部控制面观察）：[`docs/lifecycle-hooks.md`](./docs/lifecycle-hooks.md)
- Worktree 依赖环境（checkout-local 依赖视图 + 共享包缓存；生态 prepare 与验证前置条件）：[`docs/worktree-env.md`](./docs/worktree-env.md)
- 提交期 code-review（signal hook `review`，任意相位由 config 决定：detach 起、审全量 diff、不挡 commit、结果经 Board pull 投递；分支有开放 MR 时（典型 post_mr）机会性发评论到 MR 做历史）：[`docs/code-review.md`](./docs/code-review.md)
- 使用 / 安装 / 配置：[`README.md`](./README.md)
- 共享术语（repo_dir / **component** + default component / 保护分支 / PR 模型 / 验证状态 / `<PLUGIN_ROOT>`）：[`CONCEPTS.md`](./CONCEPTS.md)
- 仓库级（marketplace / 多 CLI）：[`../AGENTS.md`](../AGENTS.md)
- 完整方案与设计决策：plan 文档（开发者本地 `~/.claude/plans/devloop-plugin-0.1.md`）

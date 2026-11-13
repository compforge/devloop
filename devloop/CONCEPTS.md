# devloop plugin — 共享概念

devloop 内多个 skill / 脚本共用的术语。架构理念见 [`AGENTS.md`](./AGENTS.md)。

## 路径术语

- **subproject**：聚合工作区直接子项中「是 / 指向 git 仓」的那些目录——存在性由**文件系统自发现**判定（`domain/context/workspace.ts::discoverSubprojectNames`，判据：子目录含 `.git`），而非手写表格。workspace `AGENTS.md` 的子项目表是**可选润色**，按目录名 join 补 `aliases` / `role`（`language` 缺省自动探测，表格显式值覆盖）；表格里有、文件系统没有但目录尚存的行仍保留，渐进收敛。
- **`repo_dir`**：子项目目录入口（可能是软链接）。用前 `realpath` 确认真实路径。
- **repo**（`domain.repo.Repo`）：PR/MR 的创建、branch 开发与 forge 状态所锚定的 git 仓边界，不是一个裸路径字符串。解析边界一次算清入口路径、canonical git root、所属 workspace 与解析来源；一个 PR/MR 只属于一个 repo，而一个 repo 可以包含多个 component。
- **`component`**（`repo_layout.Component`）：仓库内 build/lint/test 等工程操作的粒度。Component 清单、名称、根目录、language、tools 与 depot 来自 `repocli inspect`；repocli 优先依据 manifest，其次依据 Makefile 识别，后者 language 未知；两者都没有时 Component 列表为空。Python workflow 与 TypeScript runtime 消费同一份协议，不自行扫描项目清单。
  - **文件归属**：在 inspect 返回的 Component 根目录中，选择包含该路径的最深一层。删除文件也按路径判断；父 Component 不重复拥有子 Component 的文件。未落入任何根目录的文件没有 Component 归属。
  - **默认执行目标**：无具体目标时，devloop 优先选择 `server` / `backend` / 仓根，其次是唯一 Component；仍有歧义则要求指定目标。这个选择策略只用于执行入口，不改变文件归属。
  - **身份与动作**：`name` 是 repocli 提供的名称，`id` 是仓相对根目录，用于组件定位；`path` 是当前 checkout 的执行路径。devloop 据此准备依赖环境；Makefile 计划、执行与复用由 RepoKit 拥有。
  - **零组件**：成功识别到空目录列表是正常 Repository 状态；验证行为由 RepoKit 报告，Git/PR 流程照常使用。
  - **失败语义**：inspect 不可用时无法确定验证对象，依赖组件信息的操作报错。可选上下文展示保留 Git 等独立事实并提示组件信息缺失，不把未知目录伪装成仓根 Component。


依赖环境同样属于 component。worktree 创建时预热、lint/test 启动前兜底；验证进程必须使用当前 checkout 的依赖视图，不能向上借主 checkout 的 `node_modules`，也不能沿用指向别处源码的 Python editable environment。跨 checkout 共享的是包管理器缓存，不是整个环境目录。详细模型见 [`docs/worktree-env.md`](./docs/worktree-env.md)。
- **`repo_code_dir`** / **default component**：repo 级**默认** component——没有更具体目标路径时用（显式按名字选仓、cwd 就是仓根）。探测规则 `server/` > `backend/` > `repo_dir`（`repo_layout.find_repo_code_dir` / `default_component`）。这是**选择**启发式（「没有具体目标该选谁」），与上面的**身份**判据（「这个目录是不是 component」）是两个问题，别拿它回答身份——`discover_components` 曾用它补根 component，而 `server/` 存在时它返回 `server/`（早被枚举收过），于是补根永远补不进、根的 go.mod 从 catalog 里消失。Go / TS 单 component 仓通常就是 `repo_dir`。子项目 `AGENTS.md` 一定在默认 component 下面。

## 保护分支

分支是否受保护是**派生**的（不持久化为仓库事实）：注入头部据此打 `⚠️ PROTECTED`，而 `protect-branch` guard 走 `domain/context/gate.ts::evaluateGate()` 按 live 分支名判。规则在 `lib/git-state.ts::isProtectedBranch()`：`main` / `master` 严格匹配；`release` 严格匹配或以 `release` 开头 / 结尾；`release` 出现在中间不算（`feat/release-notes` 不受保护）。

## PR 模型（PR/MR 统一概念）

PR 以目标 Repository + number 标识，生命周期为 open / closed / merged。repocli 拥有状态观察
与源仓分支、目标仓、local branch、checkout 的关联查询；devloop 不维护第二份 PR 缓存。
`RepoContext`、Gate、Board 在查询时构造视图，错误和歧义不等价于无 PR。

merged 停止普通状态轮询，closed 可重新打开。分支关联仍会更新，防止历史 merged PR 覆盖复用
分支上的新工作。回收前核验远端关联与即时 Git 身份，primary checkout 始终保留；已完成 PR 的
linked checkout 沿用既有回收策略，branch ref 独立保留。

详细 owner、查询和副作用契约见 [PR 对账](docs/pr-observation.md) 与 [分支门禁](docs/branch-state.md)。

## 分支状态流转

devloop 循环（`enter → 提需求 → 开发 → commit/PR → 人工 merge → 下一轮`）里，当前分支始终处于四态之一。处理强度按"是否有合法编辑场景"分两档——**没有合法编辑场景的硬拦，有合法例外的软提示**：

| 态 | 含义 | 派生自 | 处理 |
|----|------|--------|------|
| **protected** | main / master / release* | `is_protected_branch` | **硬拦** commit/push（`protect_branch`） |
| **healthy** | 普通 feature 分支，仍在开发（非以下三态） | 默认 | 正常开发 |
| **in-flight** | 已建 PR、等人工 merge | `branch_pr_in_flight`（state=open） | **软提示**（Board turn item）：新工作切新分支、改本 PR 才在此编辑 |
| **inactive** | PR 已 merged / closed | `branch_pr_inactive`（state∈{merged,closed}） | **硬拦** Edit/Write（`branch_merged_guard`） |

**为什么 in-flight 是软提示而非硬拦**：protected / inactive 在其上编辑**没有任何合法场景**，硬拦干净。in-flight 有一个合法例外——应评审改自己这条 MR（amend）——且"新工作 vs amend"无法可靠自动区分。硬拦就必然要逃逸口，逃逸口要么低命中（如 slash command）、要么把简单事弄复杂。所以由状态源提供 in-flight 事实，再让 Board 以 turn item 喂给 AI，由它自行选"切新分支"还是"在此 amend"，比硬拦更合适——这是软提示杠杆，不是硬拦杠杆。

一轮生命线全图与各拍的 hook/script 时序见 `docs/loop.md`。

**fork-off 的真正防线是 Branch 事务，而非提示**——`domain.branch` 的 **base 由意图定，不由 HEAD 当前态定**：开新工作在编辑前通过 `branch.py create` cut 自刷新后的 `origin/<target>`（或显式 `--base` 栈式）；兼容的 commit-time `--branch` 也复用同一事务。新分支只许带本轮提交，夹带外来 commit 在 push/MR 前被自检拦下。这是结构性保证：哪怕 AI 没看提示，从 in-flight 分支 fork 也不会把它的提交带进新 PR。提示负责“别把新活提交到在途 PR 上”，Branch 事务负责“别 fork 出夹带”。

## Owner / guest session（checkout 占有）

聚合工作区下多个 CLI session（claude / codex …）并发操作同一 workspace 是常态；每个 checkout 跨 Harness 同一时刻只属于一个 session：

- **owner**：第一个对该 checkout 做**变更动作**的 session——Edit/Write、切分支 / commit 等会碰可变面（working tree / index / 分支位置）的操作，任一建立占有；统一持有 `<git_root>/.devloop/owner.lock`，记录 harness、session、pid 与 TTL。Claude、Codex、DSH 竞争同一把锁。占有点：edit guard 首笔编辑 / checkout guard / posttool git 变更。**enter / 只读不占有**：enter 只是选中上下文，多 session 并读不互斥。
- **guest**：除当前 owner 外的其它并发 session（包括其它 Harness）。guest 的两条破坏路径被硬拦——切分支（`checkout_owner_guard`）与直接 Edit/Write（`edit_owner_guard`），统一引导走 managed-worktree 脚本创建隔离 checkout。
- **gitignored 文件豁免**：guest 写 gitignored 路径（eval 输出、运行日志…）放行——不进 owner 的 status/diff，无混入风险；放行不转移占有权。
- **释放（两层都有）**：session 正常结束由 SessionEnd 或 agent disposed adapter 立即清掉本 session 的全部运行态（owner 锁含 worktree checkout + active 绑定）；崩溃 / hook 没跑到时退化到 pid 死亡判活，TTL 兜底。
- 刻意共享 checkout 的逃逸口：人工删对应的 `owner.lock`。

为什么这样设计（acquire 跟活动走、edit 也要拦）见 AGENTS.md〈Owner 锁〉。

## Session 运行态

session-scoped 运行状态的统一生命周期约定：**activity 时创建 → SessionEnd / agent disposed 释放 → pid / TTL 兜底过期**；落盘一文件一 owner（owner = session）。实现统一在 `domain/context/session.ts`，三个 Harness 共用。当前两个实例：

- **checkout 占有**：`<git_root>/.devloop/owner.lock`（上节）。
- **repo 绑定**：`<workspace_root>/.devloop/active/<session_id>.json`——"该 session 最近在干哪个仓"，喂脚本兜底解析与 workspace 根的 Board turn view。hook 使用 payload 身份，脚本由 `SessionIdentity` 从 `CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID` 识别当前 harness 与 session。**绝不读别的 session 的绑定当答案**：无绑定即拒绝兜底、要求显式 `--repo`，他人绑定仅在报错里作候选提示——拿不准时最多麻烦一次，绝不静默走错仓。

## 验证状态

验证结果归 `checkout × Component × check`，各自保存独立记录；branch 域的
`branches/<b>/lint.json` 与 `test.json` 按 Component 仓相对路径保存对完整检查结果的引用。
同一 check 的并行 worker 各写自己的结果，协调器等待结束后更新 branch 引用，避免共享段互相覆盖。
不同 checkout 的执行环境独立，不因 Component 相对路径相同而直接复用结果。

**覆盖范围、内容一致性、结果复用分开判断**：repocli impact 的 affectedFiles/testFiles
决定检查哪些文件；整仓 snapshot 确认分析、执行和暂存使用同一份代码；检查输入 fingerprint
决定已有通过结果能否复用。声明完整输入的检查按 Component 内容、依赖 Component 与共享路径
计算指纹；没有完整声明时保守绑定整仓内容。配置与边界见
[仓库工具包与开发流程](docs/repository-toolkit.md)。

复用要求命令、文件集合、输入指纹和受管理依赖环境一致，不以编辑计数判断。未命中只执行
原计划，不扩大检查范围。复用成功后证据关联到本轮核对的仓库快照，保留原执行时间；
TypeScript gate 核对当前快照与依赖回执，不能把历史通过直接当作当前通过。

定向检查结果可以复用，但不授予完整 Component stamp；完整检查不能复用定向通过结果。
Board 展示历史执行事实，提交门禁负责实时有效性。旧记录不迁移成新协议的通过证据，首次重新验证。

## 状态文件 `.devloop/`

AGENTS.md 是文字知识源；`.devloop/*.json` 是由 hooks / scripts 维护的结构化运行态，不保存 AGENTS.md 正文。

- Workspace 级：`<workspace_root>/.devloop/context.json`，保存 workspace AGENTS.md 的 References + 文件系统自发现的 subproject 清单（叠加 AGENTS.md 表润色，symlink 子项目附 canonical 路径映射）；`active/<session_id>.json` **一 session 一文件**保存该 session 绑定的最近活跃 repo（脚本在 workspace 根被调用时的解析兜底）——这是 session 态而非 workspace 态，owner 即 session，按 writer-owner 铁律落盘零例外；多 session 各干各的仓互不劫持。语义与生命周期见〈Session 运行态〉。
- Repo 级按 owner 保存工作流状态：repo 域保留 `agents.json` 知识缓存及 observability ledgers；branch 域保存 `review.json` 等任务证据。Repository metadata、branch/checkout 观测、创建来源与 remote tips 归 RepoKit；validation 执行历史也由 RepoKit 管理。`RepoContext` 查询这些事实形成内存视图，不复制到 `.devloop`。working-tree 域的 owner 锁与一次性 `commit_msg` 留各 worktree 自己的 `.devloop`；主仓 `tmp/` 存进程间临时文件。连续 review history 从 Forge comments 派生。见 [分支状态与决策边界](docs/branch-state.md)。

### Board Note 与消费

Board 按不透明 id 管理 Note，scope 表达 workspace/repo/component/branch 粒度，不建立包含树。
生产方通过 upsert 提交字符串或 MergeableText；full 始终保存最新全量，queue 保存尚未消费的生效更新。
text() 返回全量文本，delta() 返回并移除待消费更新；两者按 scope 分组，不输出内部 id。
生产方拥有身份与相关性，Board 不从缺席推断删除。显式 remove 同时移除 full 和 queue。

Harness + session 的文本快照跨进程保存，更新和消费在同一文件锁事务内完成。
Claude/Codex/DSH 消费 delta，OpenCode 每次请求读取 text；compaction 恢复当前状态 Note，
不重放已消费 review。具体契约、持久化与生命周期见 [Board](docs/board.md)。

## 脚本的 repo 解析

commit_flow 与 cwd 解耦（session cwd 在聚合工作区常驻 workspace 根）：repo 按"显式参数（`--repo` 名/路径）→ cwd 所在仓库 → 本 session 绑定的最近活跃仓（`active/<sid>.json`，见〈Session 运行态〉）"解析，解析来源自述在输出/PLAN 里。本 session 无绑定即拒绝兜底，报错附其它 session 的活跃仓做候选提示。名字统一走 `scripts/domain/repo.py` 的模糊匹配。

## 占位符 `<PLUGIN_ROOT>`

skill / 文档里脚本调用写 `<PLUGIN_ROOT>`，AI 按当前 CLI 替换：Claude Code → `${CLAUDE_PLUGIN_ROOT}`。这样不写死某一 CLI 的 env，未来加 CLI 只多一行映射约定。

## 变更策略引擎（Change → Target → Rule → Decision）

PreToolUse 守卫统一成一个策略引擎（`hooks/core/` + `hooks/rules/`）：一次工具调用投影成 **`Change`**（携带 `Command` / `FileChange` 等 **`Target`**），跑匹配的 **`Rule`** 产出 `Finding`，聚合成 **`Decision`**（allow/warn/deny）。两个入口 hook——`pretool_policy_bash`（命令侧）、`pretool_policy_edit`（编辑侧）——把原先 11 个独立 guard 收成 2 个。

- **`Target`**：被规则评判的主体（开放层级，仿 k8s resource）。`Command`（`cmdtree` 投影）/ `FileChange`（`codemodel` 投影，惰性带 `imports`/`decls`/`layer`）。**无顶层 operation 轴**，动词内置（`Command.subcommand` / `FileChange.mode`）。
- **`Rule`**：可积累的判定单元，子类住 `hooks/rules/{command,edit,code}/`、登记进 `rules.REGISTRY`；引擎按 `target_kind` 路由。`needs_content` 的 FileChange 规则才触发内容解析。逐规则 **fail-open**（守卫的 bug 绝不拦用户）。命令侧规则按风险黑名单设计：默认放行，只拦高置信的项目级 / 协作级风险，不把未知命令当违规。
- **`Decision`**：`Finding.severity` 聚合——`deny`→硬拦（杠杆②）、`warn`→软提示。**刻意不叫 `verdict`**：`verdict` 专指评测 harness 的结构化输出。
- **`arch` 配置**（`config.arch`）：层级依赖规则（`layers`/`order`/`enabled`），走 config 分层、默认 opt-in off。

完整设计与取舍见工作区 `docs/loop-architecture-v2.md`。

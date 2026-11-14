# Repository

Repository 是 branch、PR/MR、checkout 和 Component 所属的仓库边界。RepoKit 提供仓库事实与操作能力，
devloop 组织开发策略、session 协作与交付流程。

## Component 与依赖资源

Component 直接投影 RepoKit 提供的 `tools`、`depot` 和独立 `toolEvidence`，Python 使用
`tool_evidence`。Tool/Depot/Bin 类型来自 common。
一个 Component 至多对应一个逻辑 Depot，Bin 的路径是 checkout 相对路径，workspace 成员可共享
同一物理 Bin。目录回收后逻辑声明仍存在；发现、安装根解析、准备回执和验证复用归 RepoKit。

RepoKit 通过依赖 Bin 的 witness 判定验证复用；依赖缺失时执行真实检查。
Component 投影描述资源，回执解释、复用与目录回收由 RepoKit 负责。

## 工具包与开发流程

RepoKit 拥有 Repository 的组织、Git/Forge 操作、验证执行与资源维护。devloop 负责开发策略、
managed Git 策略、review 和 Board。AI 按 skill 直接执行 `repocli validate`、`repocli pr`
和 `repocli clean` / `repocli worktree clean`。程序内的 Git/Forge 操作同样优先使用已有 CLI 契约；
CLI 未覆盖的操作及本地结构化分析使用 toolkit。访问配置统一归 RepoKit。
CLI 的版本基线与消费规则统一见 [repocli](../references/repocli.md)。原生 SDK 依赖独立锁定。

CLI 交付命令结果 envelope，SDK 返回领域对象。AI 同时检查退出状态、outcome、diagnostics 与
`data` 的领域判定，再决定开发流程是否继续；成本直接消费 `cost`，不从历史耗时另行推算。
结果未知时先核验目标事实，部分失败保留已确认动作。具体恢复规则归各 skill，程序消费 CLI 时只在边界做有超时的调用和契约解码，不复制
Repository 逻辑、结果缓存、重试或第二套错误分类。

### 验证与 PR 交付

验证计划、Makefile 执行、输入指纹、执行历史和复用判断均归 RepoKit。AI 在提交代码或提交 PR 前
执行验证并检查 envelope 的 outcome、diagnostics，以及 `data` 的 passed、complete、inputsConsistent
和各 Component/check 的范围与结果；format 后按新的内容执行 lint/test。
CLI 缺失或检查失败应明确报告，不能换一个执行器声称通过。验证是否足以交付由 skill 指导 AI 判断，
commit/push 脚本不自动执行检查，也不消费验证记录作为门禁。

repocli 默认在 RepoKit home（`REPOKIT_HOME` 或默认 `~/.repokit`）保存执行历史。devloop 不装配第二套验证输入、回执或复用缓存。
AI 通过 `repocli validate history list/show` 查询保留的执行、日志、慢 case 和输入证据；
`repocli validate --history` 提供汇总统计。历史用于诊断，当前输入的验证与复用仍由正常 validate 决定。
查询与结果判读见 [验证历史诊断](../skills/validate/references/spec.md#history-diagnosis)。
Board 使用 RepoKit TS 原生 `listValidationRuns`，按 checkout 查询最近三次执行，
以 `includeInputs` 一次取得本页输入摘要，再与当前 snapshot 比较。它不读取完整日志、
不直接解析 WAL、不复制历史，也不包装 CLI 子进程。输入摘要完整不代表日志齐全；
源码未变不证明工具链或外部输入未变，更不授予当前通过或复用结论。
Go/TS 的支持范围与公共错误分类以 [RepoKit validation 契约](https://github.com/compforge/repokit/blob/main/docs/validation.md#原生历史查询-api-与存储边界) 为准；
Python 尚未提供原生历史读取。
Board 不读取 `.devloop/validation_results`、分支 lint/test 引用或 `validation_scope`。

`gcampr` 是 skill 编排：验证 → managed commit/push → 原生 PR 创建或更新 → 检查并启动 review。
PR 标题、正文和目标仓由 AI 显式传给 CLI，不自动把 commit message 追加到已有 PR。
CLI 和 SDK 均由 RepoKit 的 `<home>/config.json` 解析 Forge 访问配置；devloop 不读取或注入凭据。

### Managed Git 事务

提交范围由调用方选择，路径解释、候选 index、gitlink 注册和提交核验由 RepoKit 负责。
`domain.commit` 消费 `repocli git commit plan/create`，只检查敏感路径及返回身份；保护分支、
checkout owner、PR 生命周期和外来提交检查仍归 devloop。预览固定 branch、父 commit、tree 和
index 指纹，pre_commit hook 消费同一份路径；hook 改变输入时 create 拒绝并要求重新审查。
不传 `--file` 使用 tracked 模式；显式参数是 checkout 根相对字面路径，目录由 CLI 展开，
不再猜测调用 cwd。范围外已有暂存拒绝提交；候选敏感写入整体拒绝，不悄悄过滤，敏感删除允许。

原生 Git hooks 由 CLI 执行。只有实际 commit 的父版本和 tree 匹配计划，且 index 安装完成，
managed flow 才继续；hook 改变提交树、未知响应或 index 安装失败会停止并展示核验/恢复指引。
已经生成的 commit 不自动 reset 或重做。失败候选由 RepoKit 保存在 Git 目录，devloop 不另存事务。
普通分支发布调用 `repocli git push`，直接携带刚确认的 commit；没有新提交时才读取当前 branch tip。
只有同一目标远端 SHA 核验一致才确认发布。响应未知使用原 SHA 观察，不回退 SDK、不自动重试。
upstream 配置失败以 warning 保留已确认发布。

新工作从显式目标基线创建分支。RepoKit 提供默认分支与远端 HEAD 缓存；明确缺失时才可按开发策略
回退到本地 main/master。读取失败不是缺失，不允许借此绕过保护。
分支创建与携带改动统一调用 `repocli git branch create`；远端基线刷新、精确 stash、index 恢复和恢复记录均归 RepoKit。
`domain.branch` 只保留 session owner、基线选择的映射及 session/context 更新。恢复失败仍消费已确认的新分支身份，
并展示 CLI 返回的恢复备份与记录位置。
结果 uncertain 时停止并提示检查现场；不擅自 pop stash 或释放尚未确认结果的 checkout owner。

rebase 的 Git 事务、lease、恢复与远端核验归 RepoKit，devloop 通过 `repocli git rebase`
调用；`rebase.py` 仅保留 PR target 选择、保护/失活分支与 session 权限检查及 Board 刷新。
冲突期间允许 detached checkout，由 CLI 核验原始分支与 rebase 身份。`finish` 前由 skill 指导
AI 验证，devloop 再检查发布策略；已确认 Git 结果不会因 Board 刷新失败而要求重试。
排序和本地忽略可 best-effort，必要事实读取失败必须停止。

### PR 观察与 worktree 维护

PR、branch 和 checkout 的关联、观察缓存及 HTTP 协调归 RepoKit。devloop 按需读取原生 PR context，
构造 branch gate 与 Board 视图；review 评论、Verdict、readiness 单独读取。
无凭据、查询失败与候选歧义不能解释成无 PR。必要写入 gate 停止；Board 展示未知并继续提供其它上下文。
review 的 PR 列表和正文通过 CLI 查询；分支关联、评论、readiness、release 与 repository metadata
等没有等价 CLI 契约的能力使用原生 SDK。RepoKit 的 `forge_client` / `pull_request_context`
统一组合 origin、config 与 client；devloop 不再解析 host/provider/凭据。Python 显式消费
`repokit.cli` 查询 PR 列表和正文，目标仓库由 devloop 传入，CLI 解码与进程预算归 RepoKit。

Python workflow 不设 `scripts/lib` 中转层。命令参数与有界 CLI 协议解码归 `scripts/command.py`；配置继承、
保护分支和 review 引擎归 `scripts/domain`；AGENTS 解析归 `domain/context/agents.py`；
依赖准备时机归 `domain/worktree.py`，Component 验收与路径约束归 `domain/repo_layout.py`。
通用 Git 查询与结果直接使用 RepoKit，不经 devloop 重导出。

RepoKit 在 PR 写操作后维护本地资源。全局 `clean` 扫描 RepoKit home 的登记仓库，回收过期缓存并
保留轻量 checkout 登记；`worktree clean` 面向指定 clone，二者共用清理 service。数量阈值、merged 终态、
旧 checkout 淘汰和依赖环境释放均由 RepoKit 管理；未知创建时间视为最旧，branch refs 保留。
devloop 没有 after_success 清理回调、周期 task、monitor 注册或 Harness 活动触发的扫描进程。
用户要求清理时，AI 按 monitor skill 直接执行 CLI；纯状态查询不清理。

managed worktree 的任务名称、branch、目标基线、任务/session 归属及依赖准备时机由 devloop 决定。
RepoKit 通过 `repocli worktree ensure --prepare` 完成路径解析、创建、恢复、复用核验、登记及依赖准备。
操作与结果判断见 [worktree](../skills/git-ops/references/worktree.md)。

### 组织事实与状态归属

RepoKit inspect 提供零个、一个或多个 Component，owner 提供路径归属，包括删除路径。
不补隐式根组件，不将读取失败解释为成功的空目录。TypeScript 每次策略操作共享一次 inspection，
Python 消费显式 catalog；新的操作重新观察。CLI 与 toolkit 使用一致的 snapshot 内容契约。
子模块是独立仓库，父仓 gitlink 不包含子仓脏文件的验证状态。

checkout 与 common Git directory 关系由 toolkit 解释。仓库级状态共享主 checkout 的 `.devloop`；
无法反查主 checkout 时使用 common directory 下的 `.devloop`。owner 与 commit_msg 仍属于当前 checkout。
未知 checkout 位置保持未知，不据此推断资源已删除；Session 结束时仍释放可确认位置的 owner。
Git status、ahead/behind 或祖先查询失败均保留失败语义，不伪造 clean、0/0 或非祖先事实。

### Discussion 操作入口

通用讨论读取、发表评论、回复与 resolve 由 skill 直接调用 `repocli pr discussion`，不保留
`scripts/pr.py`。CLI 入口与输出约定见 [PR management](../skills/git-ops/references/pr-management.md#discussions)。
`review.py` 继续拥有 Finding/Verdict、修复发布条件与 review 引擎编排；其内部原生 SDK 调用
保留，不为替换通用入口新增 Python CLI wrapper。`review findings` 输出 comment ID 和可用的
thread ID，前者用于 Verdict 命令，后者用于通用 discussion 命令。

### Tag 发布

通用 tag 发布由 skill 直接调用 `repocli git tag publish`；devloop 不保留 `release.py tag`
或 Python 转发器。RepoKit 拥有目标 commit 固定、push destination 选择、已有 tag 冲突检查、
原子推送和远端核验。命令遵守 Git tag 名称语法，版本号、递增规则、模块 tag 顺序与 CI 验收归
项目契约和 skill。Forge Release 由 skill 直接调用 `repocli release latest/show/create`，
查询、目标核验、重复创建和未知结果恢复归 RepoKit；devloop 不保留 Release Python 入口。

### Repository 事实与工作流状态

远端 Forge、本地 Git 与 RepoKit home 由 RepoKit 协调。devloop 通过显式 `repokit.cli` 执行和解码
CLI 协议，通过原生 SDK 获取展示事实；不维护第二份 branch/meta/remote JSON。`RepoContext` 是瞬时读模型，
`.devloop/agents.json` 只缓存解析后的 AGENTS 知识。分支创建来源归 RepoKit，任务基线仍由 PR target 或工作流选择。
Session owner、任务、review、Board 与投递记录继续属于 devloop。代码不直接拼 RepoKit home 文件路径。

Board 的 `repo.validation` 通过 RepoKit 原生 TypeScript API 查询当前 checkout 最近三次保留 Run，
不读取 `.devloop` 旧验证戳，也不解析 WAL 或维护验证缓存。空历史与读取失败分别展示。
通过 RepoKit snapshot 与 Run input manifest 比较源码是否变化；即使源码相同，历史 passed 也不授予
当前通过或复用资格。环境、工具链与外部输入的适用性仍由 RepoKit validation 决定。
查询与源码比较共享 1 秒预算；超时显示 unavailable，不阻塞其它 Board 项目的投递。

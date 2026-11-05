# 仓库工具包与开发流程

RepoKit 提供 Repository 的组织、内容与 Git/Forge 操作。devloop 把这些能力组合成以 PR/MR 为单位的
开发闭环：确定任务范围、准备环境、执行验证、提交与发布，再处理 review 和生命周期清理。
TypeScript hook 与 Python workflow 直接调用对应语言的工具包，不通过 repocli CLI 执行仓库操作。
代码影响分析与验证执行由 Go CLI 提供；原始报告保留 ComponentImpact 的版本归属与缺口。

## 验证链路

AI 可直接调用 `repocli format/lint/test/validate`。devloop 的 Python workflow 负责依赖准备、相位基线、
分支关联与门禁策略，然后通过一次 `repocli validate --check format,lint,test --json` 执行整轮。
Makefile 解析、影响分析、冻结计划、检查执行、执行历史及复用判断均归 Go toolkit，CLI 只负责适配。
Python 原生验证 API 保留，但 devloop 不调用它作为第二套验证引擎。

format 是允许修改源码的准备步骤；RepoKit 在 format 完成后重新观察内容和影响范围，再有界并发执行 lint/test。
缺少可选 format 不阻断后续检查；执行失败则停止。检查不能改写输入，项目应忽略验证输出。
`ValidationReport.inputsConsistent` 单独表达输入一致性，complete 表达终态收集，passed 表达全部通过。
unavailable 不等于 passed；devloop 对缺少项目入口采用非阻断提示，lint 失败或输入不一致阻断，test 失败仍是 advisory。

原始报告保存在分支 validation segment，并按 Component/check 保留原始结果引用。仅完整 scope 的通过结果
建立分支 full-check 引用；局部成功只用于当前流程。复用保持实际 checkedAt，并关联到本轮核对的仓库 snapshot。
TypeScript 守卫只核对当前内容、分支引用与依赖凭据，不比较 Harness 宿主环境、不重建 Make 命令或指纹。
Board 使用报告中的 unavailable 事实；没有观察记录时为未知，不在展示时扫描 Makefile。

`.devloop/config.json` 的 `validation.inputs` 仍由 devloop 装配并传给 RepoKit：

```json
{"validation":{"inputs":{"apps/api":{
  "lint":{"components":[],"paths":["tsconfig.base.json"]},
  "test":{"components":["packages/core"],"paths":["scripts/test","fixtures"]}
}}}}
```

components/paths 声明完整传递输入，自身 Component 自动包含，嵌套归属由 RepoKit 判定。声明与本次 affected
选择无关；没有声明时比较整仓输入，非法声明直接报错。Python 依赖观察提供可信回执路径；没有可信回执时
禁止复用但仍可真实检查。RepoKit 在执行边界检查回执变化，devloop 另核对有效配置是否变化。
RepoKit 决定证据是否适用，devloop 只保存本次报告用于分支门禁，不向 CLI 提供历史报告、不重复实现复用比较。

手动开发流程入口与 gcampr 都调用 `scripts/domain/validation.py`；`run_validate.py --check lint|test`
负责仓库定位和展示。Skill 的普通检查直接调用 CLI，不需要纯转发脚本。

CLI 默认在 `~/.repocli/repositories/<name>/` 保存执行历史；同仓 checkout 共用存储和统计，复用仍限定同一 checkout。
开发验证与 gcampr 调用同一入口即可跨次复用。
`--force` 强制执行，`--history` 查询实际执行次数、耗时和复用统计。VersionTag 变化只在复用判断时忽略，
分支门禁继续核对本轮完整 snapshot。记录的原 Run 时间不能替换为本次复用时间。

Python workflow 锁定 `compforge-repokit==0.19.0`，使用 schema 2 解码器及 repository lifecycle API；依赖通过官方发布包解析，
不依赖本地源码覆盖。执行端需要支持 schema 2 与历史复用的 repocli CLI 0.54.0 或后续版本。

## 操作与策略

Worktree 的命名、任务/session 归属、复用和依赖准备时机属于 devloop。RepoKit 拥有 repository lifecycle
操作及其 worktree/环境保留策略；devloop 调用 PR 操作与刷新 API，不持有删除策略或清理回调。
本地远端 HEAD 缓存查询、`info/exclude` 规则追加和 worktree 失效注册清理由 RepoKit 提供。
默认目标缺失时的 main/master 回退、开发流程忽略哪些目录及工作流 best-effort 处理属于 devloop；
必要的默认分支读取失败向上传递，不能触发缺失时才允许的回退。
提交范围、敏感文件规则、提交说明和 PR 正文由 devloop 决定，Git/Forge 库执行动作并返回结果。
创建/复用 PR 直接调用 RepoKit `ensure_pull_request`：源仓身份、目标仓解析、默认分支读取、
完整源仓匹配与歧义检查均由工具包完成。devloop 只传递用户意图，按返回结果展示状态，并决定是否
把本次提交正文追加到已有 PR。目标选择只影响本次 PR，不改变本地 Git 验证基线。
显式 `--file` 限定完整提交的路径范围：已有暂存包含范围外路径时拒绝，交由用户决定其归属。
目录选择先用逐文件 status 展开，再过滤敏感路径；已有暂存的敏感内容新增和修改同样阻止提交。
已暂存的敏感文件删除允许提交，以便清理误跟踪内容；`git rm --cached` 留在工作区的文件不会被重新加入。
候选 add 和完整 index 检查通过 RepoKit 的验证式 stage 完成，拒绝时原有暂存（包括部分 hunk）保持
原样。gitlink 及其注册配置从同一候选 index 读取；修改 `.gitmodules` 时也检查保留的
gitlink，避免删除注册后留下悬空条目。是否要求注册是 devloop 的提交规则。
只有检查通过才安装 index；之后 commit 失败时，已验证的暂存内容仍保留供检查。
保护分支规则、rebase 事务进度和 review window 留在 devloop；库的配置和凭据由 devloop 显式装配。

RepoKit 消费 inspect 与 manifest 证据，解析共享安装根并提供只读依赖观察和显式锁定安装。
devloop 决定准备时机；已有但未经一致性验证的本地依赖可以进入项目检查，不能视为安装就绪证明。
包管理器执行结果与验证 stamp 分开记录，安装成功不能代替 lint/test。

## 事实缺口与执行结果

相位基线与初始改动路径由 devloop 提供，影响分析和检查选择由 RepoKit 完成。before/unowned 是有效分析事实，
不为删除的 Component 或无归属路径伪造执行目录。CLI 缺失、协议错误或分析失败时停止验证，不悄悄回退另一个执行器。
Remote URL 的 host/path 来自 RepoKit，provider override、API 地址和 token 装配留在 devloop。

Git status 不完整时，Board 展示 unknown，branch create 拒绝依赖 clean 假设继续操作。
写操作返回 uncertain 时，devloop 明确提示先检查实际 Git 状态再重试；rebase 保留事务，branch create
不自动 pop stash，也不释放本轮持有的 checkout owner，以免尚未确认结果时继续改变现场。

checkout 与 common Git directory 的关系由 RepoKit 提供。普通仓库和 linked worktree 的仓库级状态
共享主 checkout 的 `.devloop`；独立 Git 目录无法反查主 checkout 时，共享 common directory 下的
`.devloop`。当前 checkout 的 owner 与 commit_msg 仍存放在当前 checkout；子模块独立拥有状态。
主 checkout 无法确认时，devloop 不推断 `.worktrees` 清理范围。命名、归属、保留期限、终态清理和
依赖准备时机都是 devloop 工作流策略，不进入可供 CCR 等应用复用的 RepoKit lib。

暂存候选、工作区删除路径、index 前后文件模式和 submodule 注册事实来自 RepoKit 的结构化查询。
devloop 按原始路径执行范围与敏感文件策略；读取失败阻止提交，不解释成空改动。依赖观察和锁定安装由 RepoKit 提供，准备时机由 Python
workflow 执行；TypeScript Component 只保留组织事实。

PR 生命周期清单消费 checkout 清单，保留主工作区与 linked checkout 的区别。已知分支的 checkout
位置未知时不发布完整清单，避免将独立 Git 元数据目录当成工作区，或将未知位置当成已回收。

仓库上下文、Session owner 清理与 worktree 生命周期统一消费 checkout 语义清单；原始 Git 注册记录
由工具包解释。未知 checkout 位置保留为未知，读取失败由调用方处理：监控保留旧清单，Board 显示
未知，Session 结束时继续释放已知位置的 owner，写操作前的必要读取失败则停止流程。
配置也适用于非 Git 目录，无法观察主仓位置时只使用显式目录的配置层级。

单值 Git 查询中，detached/unborn、缺失 ref 或 upstream 是正常缺失；执行失败必须保留失败语义。
Board 的 ahead/behind 不可用时显示 `?`，不投影为 0/0。PR 选择跳过缺少身份的候选，但祖先查询
失败不会当成明确的“非祖先”：监控保留原观察，写入 gate 停止。保护分支、终态分支及 checkout
owner 规则使用既有 fail_closed 策略，避免必要事实读取失败后被通用 hook 容错路径放行。

Git 元数据路径由 RepoKit 的 `git_path` / `gitPath` 解析，rebase backend 状态与继续/终止操作也由
Python 工具包提供。devloop 选择 `devloop-rebase.json` 的文件名并管理 lease、恢复、验证和推送；
index 的修改时间用于 worktree 活跃度排序，`info/exclude` 中的忽略项也由 devloop 决定。
排序与本地忽略是 best-effort；rebase 必要状态读取失败则停止操作，保留已有事务供检查。

携带改动切分支时，RepoKit 保存并返回具体 stash 对象，恢复保留 index 与工作区的区别。devloop 决定
是否携带、目标分支和 session 归属；恢复按对象 ID 执行，并在 PLAN 展示保留的 stash 备份，避免
按共享栈的位置清理时影响其他 worktree。恢复失败或结果未知时停止流程，保留现场供检查。

提交前验证与暂存共用文件选择入口，保留字面路径、重命名两端和已暂存的敏感文件删除。normalize
前冻结验证范围，暂存前重新观察工作区，使用同一套选择规则收集 normalize 的修改。
Forge 提供平台合并状态；哪些状态应成为 Board 提醒由 devloop 决定，Python 与 TypeScript 保持相同策略。

## Repository 内容与 Component

RepoKit 的 tree 描述目录、文件、Manifest 和 gitlink 引用，inspect 描述零个、一个或多个 Component。
无 Component 时跳过验证，不运行 impact 或 make，也不写入通过戳；读取失败仍按失败处理。
单组件可以位于根或子目录；普通目录可以有组件归属，也可以没有。devloop 不再补隐式根组件，
明确执行目标仍可由用户选择。manifest 优先、Makefile 次级的发现、目录排除与 owner 由工具包提供，Makefile 验证入口选择与跨组件执行范围归 RepoKit；RepoKit 解码并校验报告协议，devloop domain 执行流程策略。

原生库与 CLI 同步使用 snapshot v2；旧摘要自然失效，不迁移旧 stamp 为新通过结果。gitlink 只绑定
父仓观察到的引用，子仓脏文件不改变父仓验证戳；对子仓的验证应在其自身 checkout 执行。
验证需要支持组合步骤与 ValidationReport schema 2 的 repocli CLI；不兼容旧报告或旧验证脚本协议。

仓库定位委托 find_checkout/findCheckout：无仓库是正常缺失，损坏元数据、权限与 Git 失败不能
转换为“没有仓库”。必要 hook 事实读取失败继续走 fail_closed，不绕过保护分支规则。

观测记录与写入前置条件分别处理查询失败。工具耗时记录跳过无法定位的路径，继续记录其他已知仓库，
不能中断后续规则检查。验证计划无法确定分支时保留旧记录并报告缺口，不写入 detached HEAD 分区；
实际规则和 rebase 的必要事实读取失败时仍停止操作，工作区状态必须完整且 clean 才允许开始 rebase。


## 单一仓库实现边界

Repository 的信息获取和操作统一属于 RepoKit：布局与身份、Git/checkout 状态、历史、暂存内容比较、
分支/worktree 操作、commit/push、PR 查询和创建均调用现成 lib 或 CLI。devloop 不拼装 Git 查询、
解析 Git 输出、实现 Forge 创建/复用，或自行解释 `.git` 拓扑；原始命令入口不作为 workflow 扩展口。
Python 消费 `compforge-repokit`，TypeScript 消费 `@compforge/repokit`；Go CLI 命令仍叫 `repocli`。

devloop 负责触发时机和开发策略：任务文件范围、敏感路径、session owner、保护分支、skill 中的验证提示、
PR 正文组织、review 和清理授权。事实失败时由流程决定停止或显示缺口，不能把失败改写成 clean、
无 PR 或缺失分支。机制回归测试归 RepoKit；devloop 保留上述流程组合与门禁的集成测试。

默认分支由 `repokit.repository.default_branch` 查询，持久缓存、TTL 和远端刷新归 RepoKit。
devloop 的 meta 只保留开发目标投影，不再存观察时间或实现查询 fallback；确实缺少事实时，
由开发流程选择本地 main/master 基线。


## 消费边界

依赖复用凭据直接来自 RepoKit `dependency_witnesses`。devloop 不读取准备回执文件或重算摘要；
它把证据路径传给验证引擎，无法取得证据时禁止复用，但仍允许按工作流策略执行真实检查。
ValidationReport 的 wire schema 由 RepoKit `decode_validation_report` 校验，devloop 的 CLI adapter
仅管理命令、退出码和超时。failed report 仍是有效事实，是否阻断由生命周期策略决定。

Python/TypeScript 使用 RepoKit `ForgeConnection` 构造 client 和 PR context。devloop 只装配自己的
配置、凭据与显式目标仓；连接标识、Forge 身份规范化、观察目录与 HTTP 协调状态由工具包维护。

PR 写操作统一调用原生 `repocli pr`（最低 0.57.0）。Python RepoKit 依赖为 0.20.0，
只作为 toolkit 使用；验证执行和提交前时机由 skill 指导 AI，workflow 不自动运行验证或消费其记录作为门禁。

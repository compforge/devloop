# 仓库工具包与开发流程

repocli 提供 Repository 的组织、内容与 Git/Forge 操作。devloop 把这些能力组合成以 PR/MR 为单位的
开发闭环：确定任务范围、准备环境、执行验证、提交与发布，再处理 review 和生命周期清理。
TypeScript hook 与 Python workflow 直接调用对应语言的工具包，不通过 repocli CLI 执行仓库操作。
代码影响分析仍由 Go repocli diff 提供；调用方保留 ComponentImpact 的版本归属与缺口。

## 验证链路

inspect 提供 Component、语言与工具证据。devloop 选择项目验证入口，normalize 后形成一次验证计划，
执行 lint/test，并用原生 snapshot 在执行前后核对内容。只有完整范围、成功执行且内容身份可用时
才记录 Component stamp；hook 使用同一内容契约判断 stamp 是否仍有效。

stamp 绑定完整仓库内容摘要。共享配置或其他 Component 内容变化同样会使旧 stamp 失效，代价是
保守重验，收益是执行侧与 gate 不再各自定义“同一份代码”。内容身份包含已跟踪和非忽略未跟踪文件，
验证输出应由项目声明忽略，不能在检查中改写被验证内容。

passed、failed、skipped、unavailable 描述实际检查结果，与 hard gate/advisory 策略分别记录。
没有验证入口属于 unavailable；影响分析明确返回空选择属于 skipped。硬 lint gate 要求有可执行入口，
test 是否阻断仍由 lifecycle 策略决定。项目在 Component 中提供 Makefile，仓库根可以聚合这些入口。
本项目的 `make fix` 先生成受 Git 跟踪的构建产物，之后 lint/test 可并行读取；验证阶段不能重写这些产物。

## 操作与策略

Worktree 的命名、任务/session 归属、复用、清理时机和环境准备属于 devloop。repocli 执行明确指定的
创建/删除操作，默认保留脏工作区；显式强制回收的决定由 devloop 生命周期作出。
提交范围、敏感文件规则、提交说明和 PR 正文由 devloop 决定，Git/Forge 库执行动作并返回结果。
显式 `--file` 限定完整提交的路径范围：已有暂存包含范围外路径时拒绝，交由用户决定其归属。
目录选择先用逐文件 status 展开，再过滤敏感路径；已有暂存的敏感内容同样阻止提交。
候选 add 和完整 index 检查通过 repocli 的验证式 stage 完成，拒绝时原有暂存（包括部分 hunk）保持
原样。只有检查通过才安装 index；之后 commit 失败时，已验证的暂存内容仍保留供检查。
保护分支规则、rebase 事务进度和 review window 留在 devloop；库的配置和凭据由 devloop 显式装配。

环境适配器消费 inspect 的工具证据；明确声明的 packageManager 优先，多种冲突线索要求澄清配置。
适配器仍负责 frozen 安装、环境就绪和项目命令回退，避免把开发执行策略塞入解析工具包。

## 事实缺口与执行结果

Working / commit / range 的改动路径由 repocli 读取，保留原始路径及 rename 两端；devloop 将路径映射
到本次验证的 Component。范围未知时退回完整验证，不当成空改动。Remote URL 的 host/path 同样来自
repocli，provider override、API 地址和 token 装配留在 devloop。

Git status 不完整时，Board 展示 unknown，branch create 拒绝依赖 clean 假设继续操作。
写操作返回 uncertain 时，devloop 明确提示先检查实际 Git 状态再重试；rebase 保留事务，branch create
不自动 pop stash，也不释放本轮持有的 checkout owner，以免尚未确认结果时继续改变现场。

checkout 与 common Git directory 的关系由 repocli 提供。普通仓库和 linked worktree 的仓库级状态
共享主 checkout 的 `.devloop`；独立 Git 目录无法反查主 checkout 时，共享 common directory 下的
`.devloop`。当前 checkout 的 owner 与 commit_msg 仍存放在当前 checkout；子模块独立拥有状态。
主 checkout 无法确认时，devloop 不推断 `.worktrees` 清理范围。命名、归属、保留期限、终态清理和
依赖准备都是 devloop 工作流策略，不进入可供 CCR 等应用复用的 repocli lib。

暂存候选、工作区删除路径、index 前后文件模式和 submodule 注册事实来自 repocli 的结构化查询。
devloop 按原始路径执行范围与敏感文件策略；读取失败阻止提交，不解释成空改动。环境准备由 Python
workflow 执行，TypeScript 的 Component 只保留验证命令选择。

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

Git 元数据路径由 repocli 的 `git_path` / `gitPath` 解析，rebase backend 状态与继续/终止操作也由
Python 工具包提供。devloop 选择 `devloop-rebase.json` 的文件名并管理 lease、恢复、验证和推送；
index 的修改时间用于 worktree 活跃度排序，`info/exclude` 中的忽略项也由 devloop 决定。
排序与本地忽略是 best-effort；rebase 必要状态读取失败则停止操作，保留已有事务供检查。

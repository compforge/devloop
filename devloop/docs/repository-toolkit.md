# 仓库工具包与开发流程

RepoKit 拥有 Repository 的组织、Git/Forge 操作、验证执行与资源维护。devloop 负责开发策略、
managed Git 事务、review 和 Board。AI 按 skill 直接执行 `repocli validate`、`repocli pr`
和 `repocli worktree clean`；插件程序直接调用各语言 toolkit，不通过 subprocess 包装 repocli。
Python 依赖锁定 `compforge-repokit==0.21.0`，CLI 最低版本为 0.58.0。

## 验证与 PR 交付

验证计划、Makefile 执行、输入指纹、执行历史和复用判断均归 RepoKit。AI 在提交代码或提交 PR 前
执行验证并检查 scope、diagnostics、inputsConsistent 和各检查结果；format 后按新的内容执行 lint/test。
CLI 缺失或检查失败应明确报告，不能换一个执行器声称通过。验证是否足以交付由 skill 指导 AI 判断，
commit/push 脚本不自动执行检查，也不消费验证记录作为门禁。

repocli 默认在 `~/.repocli` 保存执行历史。devloop 不装配第二套验证输入、回执或复用缓存。
Board 不再读取旧 `.devloop/validation_results`、分支 lint/test 引用或 `validation_scope`。
当前 TS/Python SDK 尚未提供验证历史读取 API，因此 Board 暂不展示验证历史；历史查询使用
`repocli validate --history`。恢复展示必须消费 RepoKit 公共读取 API，不读取 WAL 内部格式、
不复制历史、不包装 CLI 子进程。旧磁盘记录保留，但不再参与展示或决策。

`gcampr` 是 skill 编排：验证 → managed commit/push → 原生 PR 创建或更新 → 检查并启动 review。
PR 标题、正文和目标仓由 AI 显式传给 CLI，不自动把 commit message 追加到已有 PR。
CLI 使用自己的环境凭据；devloop 的 Forge 配置供 review、Board 等 toolkit 调用方使用。

## Managed Git 事务

提交范围、敏感文件、checkout owner、保护分支与外来提交检查由 devloop 负责，Git 动作由 RepoKit 执行。
显式 `--file` 限定完整 index 的路径范围；目录先展开成文件再检查敏感路径。
已暂存的敏感文件删除允许提交，留在工作区的文件不会重新加入 index。
候选 index 与 gitlink 注册检查通过后才安装 index；拒绝时保留原有暂存和部分 hunk。
commit 失败也保留已经验证的 index 供检查。

新工作从显式目标基线创建分支。RepoKit 提供默认分支与远端 HEAD 缓存；明确缺失时才可按开发策略
回退到本地 main/master。读取失败不是缺失，不允许借此绕过保护。
携带改动切分支时按具体 stash 对象恢复，保留 index 与工作区区别，并展示保留的恢复备份。
结果 uncertain 时停止并提示检查现场；不擅自 pop stash 或释放尚未确认结果的 checkout owner。

rebase 事务、lease、恢复与推送策略由 devloop 持有。Git 元数据路径和 backend 操作来自 toolkit；
远端移动时精确 force-with-lease 拒绝覆盖。排序和本地忽略可 best-effort，必要事实读取失败必须停止。

## PR 观察与 worktree 维护

PR、branch 和 checkout 的关联、观察缓存及 HTTP 协调归 RepoKit。devloop 按需读取原生 PR context，
构造 branch gate 与 Board 视图；review 评论、Verdict、readiness 单独读取。
无凭据、查询失败与候选歧义不能解释成无 PR。必要写入 gate 停止；Board 展示未知并继续提供其它上下文。
连接配置由 `lib/config.py` 装配为原生 ForgeConnection/client，不再提供通用 Forge 转发 facade。

RepoKit 在 PR 写操作中维护本地资源，也提供显式 `worktree clean`。数量阈值、merged 终态、
旧 checkout 淘汰和依赖环境释放均由 RepoKit 管理；未知创建时间视为最旧，branch refs 保留。
devloop 没有 after_success 清理回调、周期 task、monitor 注册或 Harness 活动触发的扫描进程。
用户要求清理时，AI 按 monitor skill 直接执行 CLI；纯状态查询不清理。

managed worktree 的命名、任务/session 归属、复用及依赖准备时机仍由 devloop 决定。
依赖观察和锁定安装使用原生 toolkit；安装成功不代表验证通过。详见 [worktree-env](worktree-env.md)。

## 组织事实与状态归属

RepoKit inspect 提供零个、一个或多个 Component，owner 提供路径归属，包括删除路径。
不补隐式根组件，不将读取失败解释为成功的空目录。TypeScript 每次策略操作共享一次 inspection，
Python 消费显式 catalog；新的操作重新观察。CLI 与 toolkit 使用一致的 snapshot 内容契约。
子模块是独立仓库，父仓 gitlink 不包含子仓脏文件的验证状态。

checkout 与 common Git directory 关系由 toolkit 解释。仓库级状态共享主 checkout 的 `.devloop`；
无法反查主 checkout 时使用 common directory 下的 `.devloop`。owner 与 commit_msg 仍属于当前 checkout。
未知 checkout 位置保持未知，不据此推断资源已删除；Session 结束时仍释放可确认位置的 owner。
Git status、ahead/behind 或祖先查询失败均保留失败语义，不伪造 clean、0/0 或非祖先事实。

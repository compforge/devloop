# PR 状态查询与资源维护

Forge 是远端事实来源。RepoKit 提供原生 Python/TypeScript 查询、观察缓存、重试和
PR ↔ branch ↔ checkout 关联。RepoKit 配置访问身份；devloop 选择工作流目标仓，消费事实用于开发门禁和 Board。

PR 由目标 Repository + number 标识，源仓和源分支关联本地 branch；checkout 是可选的 Git 拓扑。
fork 工作流通过 devloop 工作流配置的 `pull_request.target_repository` 指定观察目标，AI 的 CLI 写操作则显式传目标参数。
merged 是资源维护终态；closed 仍可重新打开。merged 不冻结 branch 关联，同一分支可能出现新 PR。
多个候选保留歧义，读取失败不能当成无 PR 或已完成。

有 Forge origin 却缺凭据属于查询不可用；没有 Forge origin 才表示查询不适用。
所有开发门禁（包括 commit-only）在查询不可用或歧义时阻断。
Board 的 PR 查询等待预算为 1 秒，超时或缺凭据时展示不可用并继续其它上下文。
评论、finding Verdict 和 merge readiness 在展示时独立读取；它们失败不撤回已确认的 PR 状态。

优先通过 repocli 执行已有 CLI 操作。分支关联目前没有等价 CLI 入口，Python/TypeScript
使用原生 PR context；访问配置由 RepoKit config 解析，devloop 仅传入工作流目标仓。
RepoKit 的用户级观察与协调状态位于 RepoKit home（`REPOKIT_HOME` 或默认 `~/.repokit`），不同进程复用记录和锁，不保存原始凭据。
devloop 不复制通用 PR 缓存，也没有周期扫描 task、任务租约或 Harness 触发器。

AI 按 skill 直接执行 `repocli pr`。PR 写操作后的资源维护由 RepoKit 自行完成，不传 after_success。
显式全局清理使用 `repocli clean`，单 clone 使用 `repocli worktree clean`；二者共用 RepoKit
清理 service。缓存过期保留本地登记，后续 clean 仍可发现保留的 worktree；保留数量与保护规则
同样归 RepoKit，devloop 不维护库存或定期触发清理。纯状态查询不清理。
维护失败以动作或诊断报告呈现，不改写已经成功的 PR 操作结果。

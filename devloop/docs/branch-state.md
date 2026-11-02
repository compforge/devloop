# 分支状态与决策边界

| 事实 | 来源 | 消费方式 |
|---|---|---|
| branch、HEAD、checkout | 实时 Git | Gate 每次读取；副作用前再次核验 |
| PR 生命周期与关联 | repocli 查询 | 库维护观察与刷新；不可用和歧义明确报告 |
| 默认目标与开发基线 | Repo 配置和 devloop 创建动作 | 工作流持久化来源事实 |
| 远端 trunk tips | Git ls-remote | devloop 的 remote_branches 观察 |
| validation、review、Board delivery | devloop 工作流 | 按各自 owner 持久化证据或投递游标 |

`domain/context/gate` 是硬门禁的唯一事实入口。Python 与 TypeScript 都调用 repocli，并在网络
查询之后重新核对本地 branch/HEAD，避免慢查询期间的切分支使决策串到另一份工作上。
保护分支判断只需要 Git，不引入 Forge 网络依赖。

当前分支状态派生为 protected、healthy、in-flight 或 inactive。PR identity 包含目标仓库，
同名分支或相同编号不代表同一个 PR。库优先返回唯一开放候选；多个匹配不得任取一个。
merged PR 不再轮询，但原 branch 仍可能被新 PR 使用；资源回收前必须重新核验关联。

`.devloop` 保存业务事实与证据，不保存 PR 快照或通用关联。`RepoContext` 和 Board 是查询时构造
的视图。详细查询、刷新与回收契约见 [PR 生命周期对账](pr-observation.md)。

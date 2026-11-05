# PR 状态查询与生命周期对账

Forge 是远端事实来源。repocli 负责原生 Python/TypeScript 状态查询、本地观察、重试、周期维护，
以及 PR ↔ branch ↔ checkout 关联。devloop 配置访问身份和目标仓库，拥有开发门禁、Board 投递与
任务调度。RepoKit 的 repository lifecycle 操作自行维护本地资源。`.devloop/pr.json`、`local_pull_requests.json` 不再读写，也不做旧格式迁移。

## 查询与视图

PR 由目标 Repository + number 标识。源仓和源分支用于关联本地 branch；checkout 是可选的实时
Git 拓扑，一个 branch 可以没有 checkout，detached HEAD 没有 branch 关联。目标仓默认当前仓，
fork 工作流可通过该 Forge 配置的 `target_repository` 明确指定目标。

Gate、Board 与脚本查询 repocli，库决定本地状态是否可用、何时访问 Forge。merged 是生命周期
终态，持久保存后停止普通轮询；closed 仍可重新打开。branch 可能被新 PR 复用，因此 merged
不冻结 branch 关联。多个候选保留歧义，读取失败不能当作无 PR 或已完成。

有 Forge origin 却缺凭据属于查询不可用；没有 Forge origin 才表示该查询不适用。
所有开发门禁（包括 commit-only）在查询不可用或歧义时阻断，commit-only 仅承诺不发布。
Board 为 PR 查询提供 1 秒等待预算，超时或缺凭据时展示不可用并继续投递其它上下文；
此预算不改变 repocli 的缓存与刷新职责。

RepoContext 直接持有选中的原生 PR；生命周期对账调用 `PullRequestContext.refresh()` 并消费其分支观察与动作报告，
不再维护 recent window 或字典形式的中间库存。评论、finding verdict 和 merge readiness
由 Board 展示按需独立读取，普通 RepoContext.load / 分支刷新不触发这些请求。评论读取失败不会撤回已确认的生命周期，
readiness 失败也不会擦掉已取得的 finding 视图。devloop 只持久化验证证据、review 工作流记录、
开发基线、任务执行租约与 Board 投递游标，不复制通用 PR 缓存。

## 周期任务与副作用

Claude monitor、Codex hook、Scheduled task 和手工调用共用一次性 task。任务的进程锁与执行
cadence 只用于工作流去重；repocli 自己维护观察的到期、冷却和失败重试。已知 PR 的维护与分支
历史发现分开，单项失败保留其它可用结果，任务报告逐项未知/歧义与动作结果。
观察错误或回收延后会让单次 CLI 返回非零退出码。所有关联已知、没有开放 PR 和 linked checkout
时进入空闲周期；primary checkout 上已完成的 PR 不阻止降频。

PR 创建、更新、关闭和周期刷新都走 RepoKit 的 repository-aware 操作。devloop 不调用显式 clean，
不传 after_success 回调，不持有数量阈值或清理算法。RepoKit 复用同一个 PR observer 与关联验证，
仅将 merged 作为清理终态；数量淘汰、环境释放与保护规则由 RepoKit 管理，branch ref 保留。
维护失败作为动作/诊断报告，不改写成功 PR 操作的结果。

repocli 状态位于用户级 `~/.repocli`，Python 和 TypeScript 使用相同访问 revision 摘要和记录/锁
协议。不同短进程可以复用观察，状态中不保存原始凭据。HTTP 客户端与凭据解析继续复用统一入口。

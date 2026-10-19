# PR 观察与生命周期对账

PR 状态由 Forge 拥有，devloop 保存 Repo 范围的观察，并把 PR 关联到本地 Branch 和 Checkout。
后台请求量主要由开放 PR 和变化决定。历史分支仍可查证，其存在本身不要求每轮查询。

## 一轮观察

执行端按主仓状态目录取得进程锁，再检查任务到期时间。Claude monitor、Codex hook、Scheduled
task 和手工任务经过同一个执行入口。TS claim 只避免重复启动，Python lease 保证实际执行去重。
本地 branch/HEAD/checkout 变化会使执行端提前刷新；空闲仓库降低频率。触发频率仍由 Harness 决定。

先读取本地清单，再完整分页查询同源仓的开放 PR。上轮开放、本轮消失的 PR 按身份补查，不能把
列表缺席推断成 merged。历史查询按最久未验证排序，每轮有固定上限；带 checkout 的分支和本地
身份变化优先查证。未补齐历史的行保留 unknown，不声称已经确认无 PR。

`local_pull_requests` 的 fetched_at 表示这次清单观察；每行 checked_at / history_checked_at 保留
对应事实自己的验证时间。任何计划内读取失败保留上一份清单。`pr_observation_attempt` 单独保存
失败类型、用途和可重试时间，不更新成功观察时间。旧格式清单没有行级时间，按未知历史渐进补齐。

当前分支视图复用这次清单。最近 PR 窗口、merge readiness 和待打标统计独立刷新，使用自己的
details_checked_at；review 发布后按当前 PR 身份主动刷新。评论仍完整分页，HEAD 未变化不代表
评论或 thread resolution 未变化。
发布 PR 视图时短暂持有写锁；慢速辅助查询仅在原始观察仍未变化时写入，不能覆盖较新的实时结果。

## 决策与副作用

提交期的 live gate 只定向读取当前分支 PR。已配置 Forge 的读取失败向上传播，不能用旧窗口替代
本次要求的权威读取；未配置 Forge 的仓库保留现有不启用 Forge 检查的行为。

生命周期回收前重新读取该分支的 PR 关联，必须仍是同一个终态 PR；随后 remove_finished 核对
实时 branch / HEAD / checkout 身份。旧缓存、未知历史、读取失败或已被新 PR 复用的分支均不授权
回收。原有 primary checkout 保护及 linked checkout 回收策略继续由生命周期模块拥有。

## 请求机制与诊断

devloop 给 repocli 装配用户级 forge-http 目录，使不同 Repo 和短进程共享凭据级串行、冷却与
条件缓存。库负责 HTTP / GraphQL 分类及 ETag；devloop 负责刷新用途、频率与副作用决策。
共享状态按 host 和凭据摘要隔离，不保存原始 token。不同 token 的账号级额度关联目前不推断。

任务报告包含核心观察、辅助详情的结果、实际 HTTP 请求及 304 数、失败原因和回收动作。
限流期间保留旧观察，下一次任务不得提前发起网络请求；空闲和去重跳过与失败分别报告。
具体时间间隔和历史批量上限以代码常量为准。此流程保持一次性 task，不引入常驻调度服务。

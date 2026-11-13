# Board：上下文组织与投递

## 理念 / 概念

Board 是状态源之上的协作上下文读模型，prompt 与 UI 都只是消费者。它的边界是：
**状态源提供事实，Board 决定如何组织和投递**。

Git、forge、验证命令、review 与 workspace 解析器仍各自拥有事实；Board
不复制这些事实，也不参与硬门禁判定。它把相关事实投影成 payload-first 的
`BoardItem`：payload 是供 prompt、UI 等消费者共享的稳定读模型，prompt 文本只是
其中一个 renderer，不再是 Board 的事实形态。

## 读取与投递

producer 用 `Board.append(item)` 按稳定身份更新当前条目；它不比较 revision，也不保存投递状态。
`BoardRuntime` 是 Harness 的消费入口：

- `full()` 返回当前 focus 的完整只读 view，不改变投递基线，UI 与重建请求 context 的 Harness 可直接使用。
- `delta()` 返回相对该 session 已投递基线的新增、变化和删除条目。重复读取不消费增量，返回值的
  `acknowledge()` 在内容交给投递边界后推进基线。`deliverPrompt()` 封装 delta 的文本渲染、记录与确认。

增量比较、相关性、基线与 compaction 重放都由 Board 内部拥有，producer 和 consumer 不实现差分。
先提供一个 delta，不划分 session delta / context delta；`session_start` 只控制启动时先投递哪些条目。
正常轮次同一 revision 只投递一次，时间流逝不会重新打开投递。消失的已投递条目明确输出删除通知，
但当前 focus 之外的条目不当作源端删除；切回之前的 repo 时重新投递其当前状态。

Claude/Codex 的进程 hook 与 DSH 的注入进入保留的会话历史，使用 delta。
OpenCode 的 `session.context` 每次重建模型请求，使用 full，既不依赖上一次 hook 输出被保存，
也不维护 adapter 私有的 selected IDs 或差分状态；每个请求只有一个当前 Board 块，不累积历史快照。
全量读取不消费 delta，也不因读取导致下一次其他 consumer 漏掉变化。

UI 读取 `BoardRuntime.snapshot()` 得到 JSON-ready 的完整 view；只有 `ui` channel 的条目不进入 prompt。
投递记录按 session 存在 `.devloop/board/sessions/`，仅包含条目身份、revision、scope 和当前 focus。
`PostCompact` 让状态条目在下一轮重放；已消费 event 不会因 compaction 重放。

## 关键设计

### 相关优先，内容从小

Board 只投递当前工作所需信息。当前分支的 PR 会进入 branch 条目；与当前任务
无关的近期 PR 窗口仍保留在状态源中，供查询或后续 UI 展示，但不占 prompt
token。每个条目独立去重，某个事实变化不会捎带未变化的整块上下文。

相关性属于 `BoardView`，增量投递与重放属于 Board；事实生产者不选择 channel、
prompt scope 或重放行为。Requirement 等长期领域对象由 Baton Plugin 提供，不在 devloop
的 Harness 内 Board 建兼容投影。

### 投递状态不是业务事实

Board 本体和 view 都不持久化事实副本。`DeliveryReceiptStore` 只保存每个 session 的
条目 revision、scope 和 focus；这些数据可以安全删除或过期。repo、branch、PR 等事实仍由对应 owner 提供。
验证历史由 RepoKit 保存，Board 通过其 TS 原生 API 读取当前 checkout 最近三次执行。
列表按需携带输入摘要，与当前 snapshot 比较后展示源码 unchanged / changed / unknown；
输入缺口不抹去已知执行，历史成功也不授予当前通过或复用结论。完整日志只在显式查询详情时读取。
Board 不读取旧 `.devloop` 验证记录来推断是否执行过检查；查询预算或历史读取失败明确显示 unavailable，
不当作没有历史。能力契约与调用边界见 [仓库工具包](repository-toolkit.md#验证与-pr-交付)。
硬门禁继续读取 live truth，不依赖 Board 的展示视图或投递游标。

### 状态与事件分开重放

branch、dirty 等描述“现在在哪里”，compaction 后必须重放；review
结果和待办提醒描述“发生过什么 / 请做什么”，按身份和 revision 去重投递，避免 agent
重复处理同一件事。

Review 从当前分支的状态文件投影，prompt 与 UI 共用状态、被评审提交、finding / 失败数量、
错误原因和产物路径。运行中超过既有时限显示 stale；失败、未完成与警告不能因零 finding
显示为 clean。尚无记录和 skipped 不产生 review 条目。相同结果只提示一次，状态变化后
重新投递；Board 不负责启动或重试 review。

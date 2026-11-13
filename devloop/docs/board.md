# Board：Note 与上下文文本

## 边界

Board 按不透明 id 管理 Note。生产方决定稳定身份、归属粒度和当前相关的 Note；Board 不解析
repo、component、branch，不建立包含树，也不把本次没有出现的 Note 当成删除。
Git、forge、验证历史与 review 仍拥有业务事实；Board 保存的是可重建的文本缓存，不参与 guard 判断。

## 内容与更新

```ts
interface MergeableText {
  merge(previous: MergeableText | string): MergeableText;
  text(): string;
}

interface Note {
  id: string;
  scope: "workspace" | "repo" | "component" | "branch";
  full: MergeableText | string;
  queue: Array<MergeableText | string>;
}
```

`Board.upsert({id, scope, content})` 按 id 插入或更新。同一个 id 的 scope 保持稳定。
新 Note 的输入同时成为 full 和第一条 queue 更新。已有 Note 接收对象时调用
`incoming.merge(previousFull)`，返回新全量而不修改双方；字符串则直接替换 full。
新旧全量文本相同不入队；不同则更新 full，并把 incoming 追加到 queue。
queue 保存生效的更新内容，不要求是最小 diff；同一 Note 的多次更新按到达顺序保留。

full 始终是最新全量，已经包含 queue 中更新的效果，不是等待日志合并的 checkpoint。
`MergeableText.text()` 必须提供足以参与下一次 merge 的完整表示，不能省略合并所需信息。
当前仓库事实生产方提交完整的文本快照，使用字符串替换语义；扩展生产方可以提交 MergeableText。

## 读取与消费

- `board.text()` 返回最新全量文本，不消费 queue。
- `board.delta()` 返回待消费更新的文本，渲染全部成功后移除本次捕获的 queue 前缀。
- 两者都可以接收显式 id 集合以选择 Note；未选择的 Note 和 queue 不受影响。
- 输出按 workspace、repo、component、branch 分组排列，同 scope 内保持 Note 的插入顺序，
  不额外打印 id、scope 标签或内部状态。分组不是父子关系。
- cursor 只存在于一次消费的临时边界；没有持久化 cursor、signature、receipt 或 acknowledge。
- 读取期间新增的更新保留到下一次；没有变化时 delta 返回空字符串。

`delta()` 是消费边界。消费持久化成功后进程崩溃或发送失败不会自动重放；不承诺 exactly-once 投递。
queue 暂不限制大小，不会因容量超限静默清掉尚未消费的更新。

## 生产与 Harness 适配

`projectNotes` 从当前来源生成 NoteUpdate，并选择启动阶段和上下文重建需要的状态 Note。
review、PR 关联的身份包含所属 branch，因此 A → B → A 不会覆盖 A 的已消费状态。
读取失败不会落到 detached 分支的 review；无记录也不触发通用删除通知。

`BoardRuntime` 在会话存储事务中获取当前投影并 upsert，只读取当前相关 id。
Claude/Codex 的进程 hook 和 DSH 使用 delta；OpenCode 每次重建请求，使用 text。
全量读取不会消费待投递更新。启动阶段先消费 workspace/reference Note，保留 turn 更新。
compaction 重新建立当前状态 Note 的 full/queue，让下一次 delta 提供最新状态；已消费的 review
不会因此重放，未消费 review 的 queue 仍保留。Board 通用模型不包含这些业务分类规则。

验证历史只走 RepoKit 原生 API，一次查询本页输入摘要，不按行读取完整日志。
历史成功不代表当前通过；输入缺口显示 comparison unavailable，查询预算超时显示 history unavailable。
review 的运行、错误、失败、未完成和警告都保留文本证据；Board 不启动或重试 review。

## 持久化与生命周期

每个 Harness + 原始 session ID 对应一个快照，放在配置目录的 `board/sessions/` 下
（默认 `~/.devloop/board/sessions/`）。文件名是这两个字段的哈希，切换 cwd、repo、branch 不改变身份。
快照只保存 `schemaVersion` 和按 id 索引的 `scope/full/queue`。所有内容以 text 落盘；
恢复后 full 和 queue 都是字符串，下一次 incoming.merge 接受这个字符串，不需要 codec 或类型注册表。

`BoardStore.transaction` 在 session 文件锁内读取最新快照、投影、更新/消费，随后写临时文件并
原子替换，成功后才返回输出。渲染、解析、存储失败不会返回一个假空 Board，也不会确认消费；
失败记录带 operation、Harness 和 session 的结构化日志。锁等待最多 2 秒，原生锁随进程退出释放。
为了避免等待进程锁住不同 inode，稳定的 `.lock` 文件不在 SessionEnd 删除。

`board.remove(id)` 显式删除 full 和尚未消费的 queue，重复删除无副作用，不自动产生通知。
需要通知业务事实失效时，生产方 upsert 有意义的更新。切换视图不删除 Note。
SessionEnd / agent disposed 通过 `BoardStore.clear()` 回收快照；异常退出遗留的 session
也可通过同一显式入口回收。没有 Note TTL、hook 全目录扫描或自动容量截断。
旧工作区下的投递记录不迁移为新快照，新会话缓存从来源重新建立。

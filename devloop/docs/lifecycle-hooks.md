# Lifecycle actions

开发顺序由 skill 指导 AI：修改代码 → 直接执行 `repocli validate` → 判断结果 →
managed commit/push → 直接执行 `repocli pr create/update` → 检查或启动 review。
PR 标题和正文由 AI 根据最终改动编写；Git workflow 不自动拼接 commit body。

`pre_commit`、`post_commit` 是 Git 事务内的 action 相位；内置 action 为 `review`。
配置不提供 format/lint/test action；提交不执行验证、不按历史验证记录设置门禁。
PR 操作不进入脚本生命周期相位，PR 后的 review 由 skill 指导 AI 触发。

```json
{"lifecycle":{"default":{"pre_commit":[],"post_commit":[]},"repos":{}}}
```

`dispatch` 同步收集 action 结果；配置在 commit 相位的 review 返回 background relay，
提交成功后启动。Review 是 advisory；运行状态和 findings 通过 Board、PR 评论展示。
未知 action 属于配置错误。保护分支、session owner、精确 staging、敏感路径和 gitlink 检查继续执行。

RepoKit 负责 PR 成功后的本地资源维护，也提供显式 `repocli worktree clean`。
Devloop 不传清理回调、不启动清理 task，也不把 CLI 包成 subprocess 接口。

# Lifecycle actions

开发顺序由 skill 指导 AI：修改代码 → 显式 `repocli validate` → 查看结果并修复相关失败 →
commit/push → `repocli pr create`。修改 PR 标题或正文不需要代码验证。

`pre_commit`、`post_commit`、`pre_mr`、`post_mr` 保留为工作流动作相位；内置 action 为 `review`。
配置中不提供 format/lint/test action。验证不自动执行，也不根据历史验证记录拦截提交或 PR。

```json
{"lifecycle":{"default":{"pre_commit":[],"post_commit":[],"pre_mr":[],"post_mr":["review"]},"repos":{}}}
```

`dispatch` 同步收集 action 结果；review 返回 background relay，在 Git 动作结束后启动。
Review 是 advisory，结果通过 Board 和 PR 评论呈现。未知 action 属于配置错误。
相位涉及的 changed paths 由工作流冻结后传给 action；review 自己定义评审范围。

Git 写操作仍检查保护分支、session owner、提交文件范围、敏感路径与 gitlink 注册。
这些检查不执行项目验证、不读取验证成功戳。RepoKit 负责 Git index 事务和原生 PR 操作。
PR 成功后的本地资源维护由 RepoKit 执行，devloop 不传回调、不管理清理策略。

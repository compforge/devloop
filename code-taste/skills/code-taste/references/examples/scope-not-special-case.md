# `scope` 不应先变成特判分支

- 背景：原本只有一类 sandbox 启动路径，后来要支持 `conversation-scope` 和 `user-scope` 两种资源归属，同时还要考虑 warm pool、workspace/PVC 复用等行为
- 反例：先给 DB 加一个 `scope` 字段，然后在现有 start 流程里继续补 `if scope == user ... else ...`
  - 问题不在字段本身，而在 `scope` 已经影响资源形态、查询键、复用策略和生命周期
  - 一旦把它先建模成”局部特判”，后续 warm、workspace、restart、cleanup 都会被动跟着分叉
  - 最终代码会演化成”先决定业务路径，再顺带决定获取方式”，导致 warm 这类通用策略无法自然复用
- 正例：先承认 `scope` 是稳定业务维度，再重组 start 模型
  - 第一步先判断目标资源形态，例如 `conversation-scope` / `user-scope`、是否复用 PVC
  - 第二步再判断获取策略，例如 `reuse existing sandbox`、`reuse workspace`、`try warm`、`cold create`
  - 这样 `scope` 只是资源 shape，不是到处插入的特判入口
- 关键判断：当一个”新字段”已经开始影响资源归属、生命周期和系统路由时，它通常不再是一个普通字段，而是在暴露旧模型已经不够用了
- 适用边界：
  - 适用于新增稳定业务维度，例如 scope、租户级别、资源归属、生命周期模式
  - 不适用于纯展示字段、纯透传字段，或只在局部逻辑里短期生效的兼容参数

# 反例与正例案例

本 skill 的长期资产。抽象原则容易记住，难的是“这个具体改动该不该上设计脑、该怎么改”——靠案例积累。

**一个案例一个文件**：便于后来者按同一契约 append（不改共享文件，append-only、低冲突）。这本身也是
code-taste 那条「概念的载体不只 md，文档级概念应伺机升级为结构级」对自己的应用——“一个案例 = 一个
可积累单元”从一个 heading 升级成一个文件。

## 怎么加一个案例

1. 拷 `_TEMPLATE.md` → `<slug>.md`（slug 用 kebab-case，一句话点出判断，如 `scope-not-special-case`）。
2. 按模板填：背景 / 反例 / 正例 / 关键判断 / 适用边界。重点写“为什么这是坏味道”“为什么这个改法更稳”，
   不要只贴最终代码。
3. 在下面〈索引〉加一行。
4. **先别加机器 frontmatter**（trigger / tier / severity 等路由字段）——那留给将来的 catalog（devloop 集成层），
   有 reader + 校验才不会与正文漂移。现在加 = 没人消费的装饰，会 rot。

## 建议积累的案例类型

- 坏命名 → 好命名
- if-else 胶水 → 显式业务模型
- 浅封装 → 深模块
- Request/DTO/ORM 穿透 → 稳定边界隔离
- 日志缺上下文 → 可还原现场的日志

## 索引

- [`scope-not-special-case`](./scope-not-special-case.md) — 新增稳定业务维度，别先建成特判分支，先重组模型
- [`guard-impl-side`](./guard-impl-side.md) — 守卫 / 空值检查放实现侧，不让每个调用方重复
- [`noisy-signal-not-in-level-key`](./noisy-signal-not-in-level-key.md) — 会抖 / 异步的信号别折进"电平相等"变更键，边沿检测 + 迟滞才对
- [`constraint-by-mechanism-not-docs`](./constraint-by-mechanism-not-docs.md) — 多人协作下设计约束靠机制（收权 / 契约测试 / 运行时对账）守住，docstring 宣告挡不住新变体
- [`provider-stays-domain-pure`](./provider-stays-domain-pure.md) — 资源提供方只管理自己的领域模型，跨模型转换留给调用方或独立 Mapper
- [`large-coordinator-missing-concept`](./large-coordinator-missing-concept.md) — 超大协调器反复按同一维度分支时，优先提取概念与 owner，不只切 helper

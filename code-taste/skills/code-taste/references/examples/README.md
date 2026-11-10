# 反例与正例案例

案例用于说明原则在具体场景中的判断与适用边界；同一判断的后续证据优先更新已有案例。

## 维护案例

1. 先查索引与相关原则。同类问题补入已有案例；只有新的反例、取舍或适用边界需要独立展开时才新建。
2. 新建时复制 `_TEMPLATE.md`，文件名用 kebab-case 表达判断，写清背景、反例、正例、理由与适用边界。
3. 更新索引和原则引用；合并重复案例时保留有效证据并修复引用，失效结论同步修正或删除。
4. 机器 frontmatter 仅在已有 reader 和校验支持时引入。

## 索引

- [`query-scope-follows-consumer`](query-scope-follows-consumer.md) — 从慢查询追到消费方数据需求，按职责分派查询范围与执行能力
- [`scope-not-special-case`](scope-not-special-case.md) — 新增稳定业务维度，别先建成特判分支，先重组模型
- [`guard-impl-side`](guard-impl-side.md) — 守卫 / 空值检查放实现侧，不让每个调用方重复
- [`noisy-signal-not-in-level-key`](noisy-signal-not-in-level-key.md) — 会抖 / 异步的信号别折进"电平相等"变更键，边沿检测 + 迟滞才对
- [`constraint-by-mechanism-not-docs`](constraint-by-mechanism-not-docs.md) — 多人协作下设计约束靠机制（收权 / 契约测试 / 运行时对账）守住，docstring 宣告挡不住新变体
- [`provider-stays-domain-pure`](provider-stays-domain-pure.md) — 资源提供方只管理自己的领域模型，跨模型转换留给调用方或独立 Mapper
- [`large-coordinator-missing-concept`](large-coordinator-missing-concept.md) — 超大协调器反复按同一维度分支时，优先提取概念与 owner，不只切 helper

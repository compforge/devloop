# 超大协调器缺的通常不是 helper，而是可命名的后端与生命周期

- 背景：某诊断工具的 memory `capture.ts` 同时编排 Pydump、fork-pyheap 和两者共享的进程选择、确认、liveness、Evidence、文件回传与产物生成，文件增长到一千行以上。新增或修改一个 backend 时，准备条件、工具上传、执行命令、失败解释和 facts 都要回到同一个 coordinator 改分支。
- 反例：只把长代码块抽成 `preparePydump`、`runPyheap` 等 helper，主流程仍知道每个 backend 的前置、运行时探测、工具位置和错误语义。文件可能变短，但 backend 这个独立 owner 没有形成契约，新增第三种实现仍会修改同一批流程节点；复杂度只是从长函数变成跨文件跳转。
- 正例：提取统一 heap dump backend 生命周期，由各 backend 自己负责 debug / target 执行准备、runtime 探测、工具准备、dump command 和失败解释；共享 coordinator 只负责进程选择、用户确认、liveness、Evidence 和产物交付。Pydump 与 fork-pyheap 收口到 `infra/dump` 后，新增 backend 通过稳定契约接入，不需要让主流程理解实现细节。
- 关键判断：超过约 800–1000 行是复核信号，不是机械违规。真正的证据是同一分支维度反复穿过准备、执行、失败和产物阶段，说明代码中已经存在一个有独立行为与变化方向、但尚未命名的概念。此时应先提取概念和 owner，再由边界自然缩短文件；只按行数切 helper 不算完成拆分。
- 适用边界：适用于 coordinator、service、handler 等同时容纳多个流程、策略或生命周期的手写代码。不适用于生成代码、静态数据表、协议声明，或虽长但只有单一算法和单一变化原因的实现；这些场景仍需改善阅读方式，但不能仅凭行数判定架构缺陷。

<!--
契约：
- 文件名 = slug（kebab-case），同时是将来 catalog 的 rule id；H1 用一句话点出判断。
- 重点是判断与“为什么”，不是贴最终代码。
- 不要加 frontmatter（trigger / tier / severity 等机器路由字段）——留给将来的 catalog，
  有 reader + 校验才不会与正文漂移。
- 加完别忘了在 README〈索引〉补一行。
-->

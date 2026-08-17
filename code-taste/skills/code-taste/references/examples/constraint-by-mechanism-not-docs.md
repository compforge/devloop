# 多人协作下设计约束靠机制守住——docstring 宣告"唯一内核"挡不住第四个收尾变体

- 背景：某 chat service 一轮 chat 的收口（settle）要同时收 4 个存储面：Redis task 状态机、message 行（is_finished/error）、conversation.action_status、project_task。`lifecycle.finalize_task` 的 docstring 已宣告自己是"异常终态收尾的唯一内核"，还写了"scanner 收尾计划收敛到这里"。
- 反例：项目四五个人并行改，收尾逻辑仍随需求各自生长——正常路径 `_finalize_execute`、异常 done-callback、shutdown、scanner 四处各有一份收尾变体，且共享同一个错误幂等假设（拿 `message.is_finished` 当"没我的事"，没人对 task 状态机负责）。结果：oversize 截断保存的轮次（消息正常收口但 `is_success=False`）没有任何路径把 task 写成终态，任务卡 WORKING，scanner 每 5 秒空转，线上群聊任务 7 小时不结束。文档宣告了方向，但没有任何机制阻止背离——每个 MR 只看局部，没人先读完设计声明再动手。
- 正例：按"约束执行力梯度"把这条不变量（message 收口 ⇒ task 必离开 WORKING）从文档抬到机制：① 结构收权——收尾序列只活在 `finalize_task`，正常路径和 scanner 都改调它，绕过内核需手搓多个 repo 调用、diff 里扎眼；② 可执行契约——参数化测试枚举所有结束形态（正常 end×成功/失败、error、risk、stop、interrupt、异常炸穿、heartbeat timeout），断言同一条不变量，谁破坏 CI 就红；③ 运行时对账——orphan scanner 从"发现即跳过"改成"发现违反 → 自动 settle + 指纹 metric"，将来新路径漏收口是可观测的自愈而非卡死。
- 关键判断：判断一条约束是否真的存在，看它被违反时会发生什么——什么都不发生的约束等于不存在。review 中看到"docstring 宣告了唯一入口，旁边已长出绕过它的变体"，就是该升档的信号：修 bug 的同时把机制补上，否则同类补丁还会再来（本案例前已有 oversize 链修 message 面、lifecycle 三件套修 conversation 面，每次修一个存储面，正是"MR 序列反复修同一个缺失概念"）。
- 适用边界：适用于违反代价高的约束——线上状态不一致、任务卡死、跨存储面一致性（值得 收权+契约测试，跨存储面再补对账）。不适用于只伤可读性的约定（命名、目录、注释风格），那些停在文档/命名层即可，为它们上 reconciler 是过度设计。

<!--
契约：
- 文件名 = slug（kebab-case），同时是将来 catalog 的 rule id；H1 用一句话点出判断。
- 重点是判断与"为什么"，不是贴最终代码。
- 不要加 frontmatter（trigger / tier / severity 等机器路由字段）——留给将来的 catalog，
  有 reader + 校验才不会与正文漂移。
- 加完别忘了在 README〈索引〉补一行。
-->

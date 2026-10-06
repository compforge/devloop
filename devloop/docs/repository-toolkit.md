# 仓库工具包与开发流程

repocli 提供 Repository 的组织、内容与 Git/Forge 操作。devloop 把这些能力组合成以 PR/MR 为单位的
开发闭环：确定任务范围、准备环境、执行验证、提交与发布，再处理 review 和生命周期清理。
TypeScript hook 与 Python workflow 直接调用对应语言的工具包，不通过 repocli CLI 执行仓库操作。
代码影响分析仍由 Go repocli diff 提供；调用方保留 ComponentImpact 的版本归属与缺口。

## 验证链路

inspect 提供 Component、语言与工具证据。devloop 选择项目验证入口，normalize 后形成一次验证计划，
执行 lint/test，并用原生 snapshot 在执行前后核对内容。只有完整范围、成功执行且内容身份可用时
才记录 Component stamp；hook 使用同一内容契约判断 stamp 是否仍有效。

stamp 绑定完整仓库内容摘要。共享配置或其他 Component 内容变化同样会使旧 stamp 失效，代价是
保守重验，收益是执行侧与 gate 不再各自定义“同一份代码”。内容身份包含已跟踪和非忽略未跟踪文件，
验证输出应由项目声明忽略，不能在检查中改写被验证内容。

passed、failed、skipped、unavailable 描述实际检查结果，与 hard gate/advisory 策略分别记录。
没有验证入口属于 unavailable；影响分析明确返回空选择属于 skipped。硬 lint gate 要求有可执行入口，
test 是否阻断仍由 lifecycle 策略决定。项目在 Component 中提供 Makefile，仓库根可以聚合这些入口。
本项目的 `make fix` 先生成受 Git 跟踪的构建产物，之后 lint/test 可并行读取；验证阶段不能重写这些产物。

## 操作与策略

Worktree 的命名、任务/session 归属、复用、清理时机和环境准备属于 devloop。repocli 执行明确指定的
创建/删除操作，默认保留脏工作区；显式强制回收的决定由 devloop 生命周期作出。
提交范围、敏感文件规则、提交说明和 PR 正文由 devloop 决定，Git/Forge 库执行动作并返回结果。
保护分支规则、rebase 事务进度和 review window 留在 devloop；库的配置和凭据由 devloop 显式装配。

环境适配器消费 inspect 的工具证据；明确声明的 packageManager 优先，多种冲突线索要求澄清配置。
适配器仍负责 frozen 安装、环境就绪和项目命令回退，避免把开发执行策略塞入解析工具包。

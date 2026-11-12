# Worktree 依赖准备

devloop 一次调用 `repocli worktree ensure <path> --branch <name> --base <base> --remote origin --prepare --timeout 12m --json`。
RepoKit 完成 checkout 核验、创建或复用、登记及依赖准备；devloop 决定任务命名、基线与是否带告警继续。

## 结果与策略

`scripts/domain/worktree.py` 通过 `repokit.cli` 启动命令并消费其协议。成功或部分成功时，只有
`confirmed=true` 且路径/分支匹配才返回 checkout。`ready=false` 保留逐 Bin 原因和安装输出作为告警，
不撤销 checkout，不宣称依赖就绪。CLI 缺失、超时、失败、未知或协议错误停止，不自动重放或回退 SDK。

RepoKit 拥有 Component → Depot → Bin、指纹、锁定安装、回执、共享 Bin 去重与阶段成本。整轮预算
由 CLI 控制，进程适配器额外留出 10 秒终止与结果序列化。`validate` 不隐式安装，准备成功也不代表检查通过。
已有 checkout 或锁文件变化时可独立执行 `depot prepare`；`depot inspect` 用于只读诊断，无须作为固定前置步骤。

`scripts/python` 通过 uv 的锁定脚本环境安装 devloop 自身依赖，与被检查项目的依赖环境分开。

## Component 的资源声明

Component 直接投影 RepoKit 提供的 `tools`、`depot` 和独立 `toolEvidence`，Python 使用
`tool_evidence`。Tool/Depot/Bin 类型来自 common；devloop 不保留旧 PackageTool 字段或兼容别名。
一个 Component 至多对应一个逻辑 Depot，Bin 的路径是 checkout 相对路径，workspace 成员可共享
同一物理 Bin。目录回收后逻辑声明仍存在；发现、安装根解析、准备回执和验证复用归 RepoKit。

依赖 Bin 的自动 witness 由 repocli 0.58.0 起提供。依赖缺失时执行真实检查，devloop 不维护第二份
reuse 缓存，也不在 Component 投影中解释回执或自行决定目录是否可删除。

## Repository 信息

创建和复用后的登记统一由 RepoKit ensure 完成；devloop 不再单独调用 `RepositoryState.observe()`。
登记失败以结构化诊断保留，不把已确认的 checkout 当作创建失败。RepoKit home 的解析和布局归 RepoKit；
`.devloop` 继续保存工作流和 session 状态。

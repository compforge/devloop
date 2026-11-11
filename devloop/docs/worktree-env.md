# Worktree 依赖准备

devloop 在 managed worktree 创建或复用后调用一次 `repocli depot prepare --repo <checkout> --timeout 10m --json`。
RepoKit 拥有 Component → Depot → Bin 的发现、安装根、指纹、锁定安装、回执与共享 Bin 去重。
worktree 创建和依赖准备是独立操作，devloop 只决定准备时机及告警后继续的策略。

## 结果与策略

`scripts/domain/worktree.py` 只启动 CLI、核对结果协议并整理告警；不循环 Component、不调用原生依赖准备
API，也不解析锁文件或构造安装命令。ready/prepared 和 ready/reused 不产生告警；present/preserved
记录未验证提示，允许项目检查继续，不能称为 ready。missing、stale、unsupported、failed、uncertain
和 not_run 的原因及安装器输出保留为 environment warning，不撤销已经创建或复用的 checkout。

CLI 缺失、超时、协议不匹配或观察不完整明确提示，不能回退到第二套准备实现。CLI 自身拥有 10 分钟
整轮预算，外层进程等待额外留出 10 秒用于终止和结果序列化；失败或未知结果不自动重试。
共享 lease、进程取消、安装支持范围与回执语义以 RepoKit Depot 文档为准。

输出成本来自 `cost`，包含逐 Bin 安装、核验、回执和观察/锁等待时间，devloop 不重新计算或保存依赖缓存。
AI 显式调用 `repocli validate` 并判断结果；prepare 成功不代表 lint/test 通过，validate 不隐式安装。
独立准备时可以直接用 `repocli depot inspect/prepare`，无需新增 devloop 转发脚本。

`scripts/python` 通过 uv 锁定脚本环境安装 devloop 自身依赖，位于 uv 缓存；它与被检查项目的依赖环境分开。
它不借用项目 .venv，也不让被检查仓库决定 devloop 的运行依赖。

## Component 的资源声明

Component 直接投影 RepoKit 提供的 `tools`、`depot` 和独立 `toolEvidence`，Python 使用
`tool_evidence`。Tool/Depot/Bin 类型来自 common；devloop 不保留旧 PackageTool 字段或兼容别名。
一个 Component 至多对应一个逻辑 Depot，Bin 的路径是 checkout 相对路径，workspace 成员可共享
同一物理 Bin。目录回收后逻辑声明仍存在；发现、安装根解析、准备回执和验证复用归 RepoKit。

依赖 Bin 的自动 witness 由 repocli 0.58.0 起提供。依赖缺失时执行真实检查，devloop 不维护第二份
reuse 缓存，也不在 Component 投影中解释回执或自行决定目录是否可删除。

## Repository 信息

新建 worktree 后的观察由 RepoKit 操作自身完成；复用已有 worktree 时，devloop 显式调用
`RepositoryState().observe()` 更新本地信息。home 解析和目录布局完全归 RepoKit，devloop 不拼接
用户目录、不做历史数据迁移。观察失败作为诊断保留，不把已经可用的工作区当作创建失败。
PR、checkout 信息和 CLI 验证共用 `REPOKIT_HOME`；`.devloop` 继续保存工作流和 session 状态。

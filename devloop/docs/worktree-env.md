# Worktree 依赖环境

devloop 把 checkout 隔离扩展到依赖环境：临时 worktree 不只要有独立源码，还必须让验证进程
解析到**这个 checkout 对应的依赖**。本文只记录稳定模型；具体识别文件、命令和指纹文件名以
`scripts/lib/ecosystem/` 为事实源。

## 理念 / 概念

依赖环境属于 **component**，不是 repo 的单值属性。一个仓库可以同时包含 Go、Python、Node
component，每个 component 有自己的环境判据和恢复方式。

环境要守住两个不变量：

1. **归属正确**：验证不能静默借用另一个 checkout 的依赖。仓内 worktree 缺 `node_modules`
   时，Node 会向父目录继续解析；残留的 Python 虚拟环境也可能把 editable install 指回主
   checkout。两者都可能让检查看似通过、实际检查了错误的树。
2. **内容一致**：devloop 恢复过的环境必须与当前 manifest + lockfile 对齐；恢复使用 frozen
   语义，只验证和物化依赖，不改项目声明。

共享的是包管理器的内容缓存，不是另一个 worktree 的整个环境目录。每个 worktree 保留自己的
`node_modules` / `.venv` 视图；pnpm 等工具可在这些视图背后复用全局内容寻址存储。这样既避免
重复下载，也不会把 workspace link、editable path 或分支依赖图串到另一棵源码树。

## 流程

managed-worktree 脚本创建或复用 worktree 后，按 component 枚举并调用生态注册表的
`ensure_ready`。这是预热，降低进入后的第一次验证延迟。

真正的 correctness 关口在 `lifecycle.checks`：lint/test 找到可执行命令后、启动命令前再次
调用同一个 `ensure_ready`。环境已就绪时是一次轻量检查；缺失或 devloop 指纹过期时执行一次
frozen 恢复；失败则返回明确的 environment setup failure，不伪装成 TypeScript、lint 或测试
代码错误。

normalize 后同一 lifecycle 相位会并发跑 lint/test，因此 `ensure_ready` 对每个 component 做 single-flight，
锁内重查环境，只允许一个线程写同一份依赖目录。

## 关键设计

### 插件运行环境与项目环境分开

`scripts/python` 使用 uv 的锁定脚本环境加载插件自己的 Python 依赖，环境位于 uv 缓存中。
它不要求插件目录可写，也不修改被分析项目的 `.venv`、manifest 或 lockfile。该环境在命令退出后
仍然存在，后台工作流可继续使用；项目的依赖恢复仍由下面的生态入口拥有。


### 生态是语言差异的唯一入口

Component 目录、语言与包管理工具元数据由 repocli 提供：TypeScript runtime 与 Python
worktree/validation workflow 各自调用对应语言的原生 toolkit。
`scripts/lib/ecosystem/` 拥有环境就绪、恢复命令和无 Makefile 时的 canonical 回落命令，
可以读取 manifest / lockfile 来执行项目选择的工具链。组件发现与环境执行各自只有一个入口。
inspect 失败时 worktree 仍可创建，但环境准备返回明确告警；后续验证必须取得组件目录。

### 自动恢复必须可重复

Node component 没有支持的 lockfile 时，devloop 不猜裸 install 命令，因为那可能生成或改写项目状态；
它把缺失依赖报告为环境问题。Go 的 module cache 天然跨 checkout 安全，不需要显式 prepare。

对用户自己准备、没有 devloop 指纹的现有环境保持 fail-open，避免接管主 checkout 的日常依赖
管理；一旦由 devloop 恢复并盖过指纹，manifest 或 lockfile 变化就会触发重新恢复。

### 包管理器优化由仓库选择

devloop 尊重仓库已经选择的包管理器和配置，不全局开启实验性选项。频繁创建 Node worktree 的
仓库可以自行启用 pnpm 的 global virtual store；devloop 每个 worktree 仍执行一次 frozen install，
由 pnpm 将本地依赖视图链接到共享 store。

# Worktree 依赖准备

devloop 决定何时为开发与验证准备依赖；repocli 的 Python toolkit 拥有依赖观察和显式安装。
worktree 创建与安装是两个独立操作，由 devloop 在 managed-worktree 流程中组合。

## 归属与判定

repocli 解析 Component 对应的包管理器、锁文件及安装根。同一 Bun/pnpm/npm/Yarn/uv workspace 的成员
可以共用 checkout 内的安装根，不能把每个 Component 都当成独立安装单位。依赖恢复和缓存策略遵循
包管理器，不能复用另一个 checkout 的整个 node_modules/.venv。

`scripts/lib/dependencies.py` 只保留消费策略：ready 环境直接进入验证；present 表示用户已准备了本地依赖、
但没有匹配的准备回执，允许执行项目自己的检查，不宣称锁文件一致性已获验证。有锁定安装命令的 missing
环境以及 stale 环境调用 prepare_dependencies。有些 Component 的 manifest 仅用于发行包装；当 repocli
报告 missing 且安装命令为空时，跳过自动准备并输出原因，让项目自己的检查决定结果，不创建依赖目录或准备回执。
unsupported（如依赖目录软链接、异常占位文件）、安装失败、取消和观察失败保留原因并阻断验证命令。
验证结果与门禁仍由 devloop 持有，不把依赖准备成功当作 lint/test 通过。

## 生命周期

创建或复用 managed worktree 后预热依赖；执行 normalize/lint/test 前再次观察。同一进程中的并发准备
由 repocli 按安装根串行并在锁内复查，避免 lint/test 各自安装同一 workspace。观察不执行项目脚本，
安装只使用显式的锁定操作，不自动生成或升级锁文件；更详细的支持范围和进程预算以 repocli 的依赖准备
API 为准。Go 等无需本地安装视图的 Component 不会被强加依赖目录。

`scripts/python` 通过 uv 锁定脚本环境安装 devloop 自身依赖，位于 uv 缓存；它与被检查项目的依赖环境分开。
它不借用项目 .venv，也不让被检查仓库决定 devloop 的运行依赖。

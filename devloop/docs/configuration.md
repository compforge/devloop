# 配置继承

## 统一规则

普通配置项由公共配置加载层统一解析：**全局默认 < 主仓库的特殊安排 < 当前 worktree 的显式配置**。
按字段就近取值，缺失才向上补全：当前 worktree 没配置的字段从主仓库继承，主仓库也没配置的
字段再取全局或内置默认值；不是整份配置二选一。

- 对象递归合并；数组整体替换，不追加元素。
- `[]`、`false`、`0` 和空字符串都是显式值，不算缺失，不继续向上补全。
- 继承只决定配置值，不改变验证、review 等动作的执行目录。

例如主仓库配置了提交前验证和 MR 后 review，worktree 只配置 `pre_commit: []`，最终会关闭
提交前的自动动作，但保留继承的 `post_commit: ["review"]`。

## 配置来源

用户级配置位于 `~/.devloop/config.json`，可由 `DEVLOOP_CONFIG_DIR` 改变配置目录。本地覆盖放在
目录下的 `.devloop/config.json`。加载顺序从低到高为：

1. 内置默认值与用户级配置。
2. 主仓库及其祖先目录的本地配置，由外到内。
3. 当前 checkout 及其祖先目录的本地配置，由外到内；已加载的祖先文件不重复应用。

主仓库由 Git 识别，不靠 worktree 路径猜测。因此 worktree 即使放在主仓库目录外，也能继承
主仓库配置。没有 Git 身份的普通目录仍沿物理祖先目录查找配置。

`lifecycle`、`arch` 支持 `default/repos` 写法。每个配置文件内部先取 `default`，再叠加
`repos[<主仓库绝对路径>]` 和 `repos[<当前 checkout 绝对路径>]`，然后才与下一层文件合并。
因此 worktree 本地文件里的 `lifecycle.default.pre_commit`，也能覆盖全局文件中的仓库专属值。
这只是同一来源内选择策略的写法，不改变“更近的来源优先”的统一规则。

公共 loader 返回有效配置；`lifecycle`、`arch` 的有效策略位于返回值的 `default` 中。
调用方不再自行重新叠加 `repos`，避免把已经覆盖的全局值加回来。保存和更新配置只写用户级
原始配置，不把局部覆盖或解析结果写回全局。

## 明确例外

- `workspaces` 是用户级工作区注册表，只取全局配置，忽略本地同名字段。

`review.tool`、`pull_request.target_repository` 等工作流字段遵循统一继承规则。
`pull_request.target_repository` 是可选的 PR 目标仓路径（如 `upstream/repository`），不决定访问身份。
示例结构见 [config.example.json](../config/config.example.json)。

## Repository 访问边界

Forge host/provider、API 地址和凭据全部归 RepoKit 的 `~/.repokit/config.json`；devloop 不保存、
解析或覆盖这些设置，也不从环境变量读取 token。Repository 元信息由 RepoKit 从仓库事实取得。
配置缺少凭据是查询不可用，不代表仓库没有 PR。

Repository 操作优先调用 `repocli`，按统一 envelope 检查 schema、command、outcome 与 data。
用户交互的 PR 创建、更新、查询和清理由 skill 指导 AI 直接执行；review 的 PR 列表和正文读取
也通过 CLI。评论线程、release 和包含祖先关系核验的分支关联暂未有对应 CLI 契约，使用 RepoKit
SDK，由其 config 入口取得访问配置。devloop 不实现 Git/Forge 传输，不另建缓存，不回退到自己的 token。

RepoKit 配置与 SDK 需要支持该配置契约：CLI 0.65.1、Python 0.26.0、TypeScript 0.20.0 或更新版本。
配置文件权限与完整 schema 由 RepoKit 的 `docs/configuration.md` 维护。

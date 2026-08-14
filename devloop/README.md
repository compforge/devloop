# devloop plugin

**devloop 为 AI 编码 agent 提供一条受控的 PR/MR 开发闭环**：进入仓库、在正确分支开发、验证受影响的 Component、提交并推送、创建或复用 PR/MR，最终由人完成 merge。

```text
enter repo → develop → normalize → lint ∥ test → commit → push → PR/MR → human merge
```

它支持 GitHub PR 与 GitLab MR，并根据仓库的 origin 自动选择平台。当前可运行在 Claude Code 和 Codex。

## 为什么需要 devloop

AI agent 写代码时，很多损耗不来自代码本身，而来自开发流程缺少可靠边界：

- **上下文滞后**：agent 不知道当前仓库、分支、PR/MR 和验证状态，只能从对话历史猜测。
- **约定无法执行**：保护分支不能提交、不能 `git add -A`、提交前要验证等规则，如果只写在 prompt 里，仍可能被绕过。
- **并发 session 冲突**：多个 session 共用 checkout 时，切分支和编辑会互相覆盖，聚合工作区下还容易操作错仓库。

devloop 用状态投递让 agent 看到当前事实，用受控 Git 事务和执行级守卫约束副作用，并用 managed worktree 隔离并发开发。

## 核心保证

- **Git/PR 事务**：`gcam`、`gcamp`、`gcampr` 分别完成 commit、commit + push、commit + push + PR/MR。新工作从目标分支建立干净基线，已有 PR/MR 可安全追加提交或进行可恢复 rebase。
- **Component 感知验证**：一个仓库可包含多个独立 Component，例如 `server/`、`cli/` 或 `packages/*`。devloop 根据本次改动选择 Component，并分别记录 lint/test 结果，不会用一个 Component 的通过状态覆盖另一个。
- **运行态上下文**：Board 向当前 session 投递相关仓库的 branch、working tree、PR/MR 和验证状态；进入项目或上下文压缩后会自动刷新。
- **执行级守卫**：阻止保护分支 commit/push、过期分支编辑、`git add -A`、绕过 managed worktree 等高置信风险操作。
- **并发隔离**：checkout 被一个 session 占用后，其它 session 的分支切换和源码编辑会被引导到独立 worktree。

领域主链是 **`PR/MR → Repo → Component`**。Repo 是 git、branch 和 forge 状态的边界；Component 是 lint/test 的验证单位；workspace 只是可选的多仓聚合上下文，单仓库同样完整支持。

## 快速开始

运行时要求：**Python 3.10+**。devloop 会从 `PATH` 自动选择满足版本要求的 Python；需要固定解释器时设置 `DEVLOOP_PYTHON`。

### Claude Code

```text
/plugin marketplace add https://github.com/compforge/devloop.git
/plugin install devloop@devloop
```

### Codex

```console
codex plugin marketplace add https://github.com/compforge/devloop.git
codex plugin add devloop@devloop
```

安装后新开一个 session。Codex 如果要求审核 hook，可在 `/hooks` 中信任 devloop hooks。

通常不需要手工初始化：第一次进入 Git 仓库时，hook 会自动创建所需的 `.devloop/` 运行态。之后直接告诉 agent：

```text
验证改动
gcampr
```

devloop 会选择当前仓库和受影响的 Component，完成验证、提交、推送并返回 PR/MR 地址。创建 PR/MR 和状态刷新需要对应平台的凭据，优先使用 `GITHUB_TOKEN`、`GH_TOKEN` 或 `GITLAB_TOKEN`。

## Component 验证

验证不是 lint/test 两种模式，而是对同一份稳定代码执行的多个质量检查：

```text
normalize: make fix
        ↓
stable Component content
   ├─ static quality: make lint-ci | make lint
   └─ behavior:       make test
```

- `make fix` 是可选的 normalize 步骤，也是唯一允许自动改写源码的验证命令。
- normalize 完成后，lint 与 test 可以并发执行。
- 完整验证同时检查静态质量和行为；单独要求 lint 或 test 属于部分验证，devloop 会分别报告结果。
- lifecycle 中 lint 失败会阻止 commit/MR；test 失败目前只提示、不阻塞，因为坏测可能来自基线或环境，是否与本次 diff 相关仍需 CI 或人判断。

### 项目接入契约

每个 Component 通过 Makefile 暴露稳定入口：

| Target | 要求 |
|---|---|
| `make fix` | 可选；执行 formatter/fixer，可以修改源码 |
| `make lint-ci` 或 `make lint` | 非交互、只读，所有静态检查通过时返回 0；优先使用 `lint-ci` |
| `make test` | 非交互、只读，默认运行完整测试套件，通过时返回 0 |

项目可以额外支持 Component 相对路径组成的 `TEST_FILES`：

```console
make test TEST_FILES="tests/a.py tests/b.py"
```

`TEST_FILES` 缺失或为空时必须保持全量测试语义。提交期验证和单独 run-test 采用保守策略：测试文件不超过 20 个时始终全量执行；超过 20 个、改动包含测试文件且项目显式支持 `TEST_FILES` 时，才聚焦执行 changed tests。大型测试套件尚未支持该契约时会回退全量，并非阻断地提示项目补充 `TEST_FILES`；完整 validate 仍运行完整测试套件。

Go 不应为了统一接口传单个 `_test.go` 文件；应由项目暴露 package 或 test-name 选择。完整契约见 [`spec.md`](./skills/validate/references/spec.md)，并发和 Makefile 示例按语言查看 [Python](./skills/validate/references/python.md)、[Go](./skills/validate/references/go.md) 或 [Node.js](./skills/validate/references/node.md)。devloop 不会擅自为项目新增工具、依赖或 Make target。

## 日常操作

这些名称表达事务结果，不要求用户记住底层脚本。Claude Code 同时提供同名 slash command；Codex 可直接通过自然语言或 skill 名触发。

| 操作 | 结果 |
|---|---|
| `validate` / “验证改动” | normalize 后并发运行 lint 与 test，报告完整验证结果 |
| “修下 lint” / “跑下测试” | 只执行指定检查，并标记为部分验证 |
| `gcam` | commit，不 push |
| `gcamp` | commit + push，不创建新的 PR/MR |
| `gcampr` | commit + push + 创建或复用 PR/MR |

Git 事务默认处理本次相关改动，也可以通过可重复的 `--file <path>` 精确限定提交范围。保护分支或已失效分支上的新工作必须提供新 branch，devloop 会从 `origin/<target>` 建立基线，不从当前 HEAD 偷带提交。

这些操作不依赖 session 当前停在哪个目录：优先解析显式 `--repo`，其次使用 cwd 所在仓库，再使用当前 session 最近绑定的仓库；无法唯一确定时会拒绝猜测。

并发 checkout、rebase 和 PR/MR 管理的详细流程见：

- [managed worktree](./skills/git-ops/references/worktree.md)
- [safe rebase](./skills/git-ops/references/rebase.md)
- [PR/MR management](./skills/git-ops/references/pr-management.md)

## 配置

用户级配置位于 `~/.devloop/config.json`。仓库或 workspace 可在自己的 `.devloop/config.json` 中提供局部覆盖；读取顺序是默认值、用户级配置、由外到内的本地配置，离 Repo 最近的值优先。

所有 lifecycle hook 默认关闭。一个常见配置是提交前验证，并在 PR/MR 创建后异步 review：

```jsonc
{
  "lifecycle": {
    "default": {
      "pre_commit": ["lint", "test"],
      "post_commit": [],
      "pre_mr": [],
      "post_mr": ["review"]
    },
    "repos": {}
  },
  "review": { "tool": "ccr" },
  "worktree": { "keep_recent": 5 }
}
```

`review` 是异步 signal hook，不阻塞 commit 或 PR/MR；默认引擎是 [CCR](https://github.com/compforge/case-code-review)，也可以配置为 `ocr`。结果会在后续 session 中浮现；已有开放 PR/MR 时还会尝试发布 review comment。

完整配置结构和 forge host 配置见 [`config/config.example.json`](./config/config.example.json)。token 建议使用环境变量；如果写入配置文件，不要提交仓库内的 `.devloop/config.json`。

## 更新与手工初始化

更新插件：

```text
# Claude Code
/plugin marketplace update devloop
/plugin update devloop

# Codex
codex plugin marketplace upgrade devloop
codex plugin remove devloop@devloop
codex plugin add devloop@devloop
```

更新后新开一个 session，使运行时重新加载 hooks 和 skills。用户级配置保存在 `~/.devloop/`，不会被插件更新删除。

如果需要提前注册单仓库或聚合工作区，可以手工运行：

```console
# Claude Code: 将 <PLUGIN_ROOT> 替换为 ${CLAUDE_PLUGIN_ROOT}
# Codex:      将 <PLUGIN_ROOT> 替换为 ${PLUGIN_ROOT}
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/init_repo.py
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/init_workspace.py <workspace>
```

## 边界与兼容性

- Claude Code 使用完整 native events；Codex 缺少的 `CwdChanged`、`FileChanged`、`SessionEnd` 由现有 hook、下一轮刷新和 TTL 路径降级补足。
- devloop 负责单个开发闭环中的 repo/branch、验证、commit/push、PR/MR、review 和执行守卫；不负责跨仓需求编排、部署或长期调度。
- 多 Component 可以独立验证，但跨 Repo 的 fan-out 和发包依赖顺序不由 devloop 编排。
- merge 始终由人完成；test 和 AI review 提供决策依据，不替代 CI 与人工判断。

## 深入阅读

- [`CONCEPTS.md`](./CONCEPTS.md)：Workspace、Repo、Component、PR/MR 等稳定术语
- [`docs/loop.md`](./docs/loop.md)：完整开发生命周期
- [`docs/lifecycle-hooks.md`](./docs/lifecycle-hooks.md)：normalize、lint/test checks 与 lifecycle hook
- [`docs/code-review.md`](./docs/code-review.md)：异步 review 与 comment 交付
- [`docs/board.md`](./docs/board.md)：状态组织和上下文投递
- [`AGENTS.md`](./AGENTS.md)：架构边界与开发约定

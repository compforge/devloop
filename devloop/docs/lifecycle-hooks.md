# devops 生命周期 hook（lifecycle hooks）

把「在某个 git 生命周期相位触发的验证 / 动作」收成一个统一的 facade：`pre_commit` /
`post_commit` / `pre_mr` / `post_mr`。lint、test、（后续）code-review、e2e·eval·perf
verdict 形状相同，过去各自 ad-hoc 接线——本机制让它们都退化成挂在相位上的 hook。

本文分三段：概念（这是什么、为什么有）、流程（一次 commit 怎么走）、关键设计（几个
「为什么这么做」）。易变的字段 / 阈值不进本文，看代码。

---

## 一、概念

**为什么需要一个新缝。** devloop 是 native-first：能坐 Claude Code 原生事件就不自造。
但 CC 原生事件只到**工具层**（`PreToolUse(Bash)` 看命令字符串），**git 生命周期这个
altitude 没有原生事件**。所以 lifecycle 是一个正当的「缺失 facade」——与 `lib/forge`
（评审平台 facade）同性质，不是重造原生事件。

**dispatch 永远同步。** 它并发起一个相位上的全部 hook、join 等全部返回再聚合（`lint ‖ test`
同跑，墙钟 = 最慢那个）。它**不能**起「跑完唤醒 session」的后台任务（subprocess 派生的子进程
harness 不跟踪、跑完不会 re-invoke 会话）——异步靠某个 hook 体只做「发信号」这件快事来表达。

**三种 hook 模式，由 `HookResult` 两个字段（`relay`、`advisory`）编码，不需要单独 mode 枚举：**

| 模式 | 字段 | 例 | 失败时 |
|------|------|----|--------|
| **硬拦截**（gate） | `relay=None, advisory=False` | `lint` | `ok=False` → 抛 `SmartError`、中止 commit/MR |
| **软提示**（advisory） | `relay=None, advisory=True` | `test` | `ok=False` → 只通报（PLAN `⚠`），**放行** |
| **异步信号**（signal） | `relay=BackgroundSpec` | `review` | 恒 `ok=True`、永不挡，下游 detach、下轮浮现 |

- **软提示存在的理由**：test 挂常因基线坏测 / 环境，与本次 diff 未必相关；「该不该拦」本质是
  「diff 是否与挂掉的测试相关」，需 baseline-aware 分析（TODO）。在那之前先不硬拦，把判断交给
  CI / 人——符合「硬拦只立在没有合法例外处」。lint 快、确定、几乎总是你的代码，仍硬拦。
- **veto 与同步性的关系**：只有「inline 且非 advisory」才进 `proceed`；advisory 与 signal 都不挡。
  `proceed = all(r.ok for r in results if not r.advisory and r.relay is None)`。

涉及的对象（锚点）：

| 对象 | 位置 | 职责 |
|---|---|---|
| `dispatch` / `HookResult` / `BackgroundSpec` | `scripts/domain/lifecycle/base.py` | facade：并发 join + 聚合；纯机制 |
| normalize + `lint` / `test` checks | `scripts/domain/validation.py` | 一次 repocli validate，记录报告并应用门禁策略 |
| `run_lifecycle_gate` / `phase_paths` | `scripts/commit_flow.py` | 在 commit/mr 流水线里的 dispatch 插点 + 算出本相位「本次改动」的范围 |
| `select_components` / `committed_paths` / `range_paths` | `scripts/domain/repo.py` | 范围 → component 投影；各相位取「本次改动」的 git 问法 |
| `PrecommitGateRule` | `hooks/rules/index.ts` | 裸 `git commit` 的兜底守卫（查戳，不跑） |
| `config.lifecycle()` | `scripts/lib/config.py` | 「哪个相位挂哪些 hook」的数据（opt-in，默认空） |

---

## 二、流程

「哪个相位挂哪些 hook」是 `config.lifecycle(repo)` 的数据，**opt-in，默认全空 = 每相位
no-op、零行为变化**。配置由公共 loader 按[统一继承规则](configuration.md)解析：
全局默认 < 主仓库 < 当前 worktree，逐字段向上补全。显式 `pre_commit: []` 会关闭提交前的
自动动作，但未配置的 `post_mr` 仍可继承 `["review"]`；不是把所有相位一起清空。

策略继承不改变执行目录：验证和其他 hook 仍在当前 checkout 运行。Board 的 validation history
只报告已记录的验证结果，不表示启用或禁止验证；是否执行由 lifecycle 配置决定。配置示例：

```jsonc
"lifecycle": {
  "default": { "pre_commit": [], "post_commit": [], "pre_mr": [], "post_mr": [] },
  "repos":   { "/abs/repo": { "pre_commit": ["lint", "test"] } }
}
```

一次 `/gcam`（或 gcamp / gcampr）的同步主链路（`commit_flow.main`）：

```
resolve_intent → prepare_branch
              → run_lifecycle_gate(pre_commit)   ← normalize → lint‖test，盖各 check 戳
              → stage_and_commit                  ← normalize 改的文件在此被收进 commit
              → run_lifecycle_gate(pre_mr)         ← 仅 mr 模式；默认空
              → publish (push / 建 MR)
```

- `pre_commit` 故意排在 staging **之前**：normalize 的 `make fix` 会改文件，这些改动要被随后的
  stage 收进同一个 commit。
- **硬拦截** gate 失败（lint `ok=False`）→ 抛 `SmartError`、中止、PLAN 显示 `pre_commit: lint ✗`、
  commit 不发生。**软提示**失败（test `ok=False`）→ PLAN 显示 `test ⚠` + 一行通报、**commit 照常**。
- 配置为空 → `run_lifecycle_gate` 静默 no-op，PLAN 无 lifecycle 行。

**两个执行点，一份策略。** 正常 commit 走 `/gcam`→commit_flow，那里 dispatch 真跑
lint/test 并盖 `.devloop` validation 戳。`PrecommitGateRule` 是裸 `git commit`（AI 绕过
smart_* 直接敲）的**兜底守卫**——它不跑 lint（PreToolUse 5s 超时、fail-open，跑不了），
只查戳：lint 在 `pre_commit` 且戳过期/从未盖 → deny。两者由同一份 `lifecycle` 配置驱动。

---

## 三、关键设计

### signal hook 的下游怎么落地（detach + pull，不靠 wake）

dispatch（subprocess）不能起「跑完唤醒 session」的 harness 后台任务——它 `Popen` 的子进程
harness 不认识、不会 re-invoke 会话。所以 signal hook 不在 dispatch 里跑下游，只把它作为
`relay`（`BackgroundSpec`）返回，**由调用方 detach 起**：commit_flow 在 git 动作完成后
`Popen(start_new_session=True)` fire-and-forget 起它（`launch_background_relays`），结果落到
状态总线、**下一轮经注入 pull 浮现**——既不靠 agent 记得起后台，也不需 harness wake。
（曾试过 emit `ARMED:` 行让 agent 自己 `run_in_background` 起，实测不可靠：MR 一建好 agent 就
当任务完成、跳过尾部指令，已弃。）

### 为什么 gate fail-closed，而 signal hook「永不挡」是 handler 的契约

dispatch 对 handler 抛异常一律收敛成 `ok=False`（fail-closed：把关出错按未通过处理，宁可
挡不可漏）。但 code-review 这类 signal hook **不该**因内部出错而挡住 commit——这通过
**handler 自己 catch 内部异常、恒返回 `ok=True`（必要时带告警 summary、不带 relay）**
来保证，是 handler 的契约，不是 dispatcher 的特例。dispatcher 因此保持极简：一种行为。

### 验证执行与流程策略

`run_validate.py` 与 lifecycle dispatch 共用 `scripts/domain/validation.py`。适配层准备依赖，
把本相位的基线、路径、检查项和已有证据交给一次 repocli validate，再保存原始报告和应用门禁。
fix 先完成、重新规划、有界并发执行 lint/test 都由 repocli 保证；devloop 不另建执行器。

### 「本次改动」的范围由相位边界给，不由 handler 猜

handler 手里只有 `repo`。想知道「本次改动涉及哪些 component」，它只能去读工作树——而**那个
答案只在 `pre_commit` 成立**：改动尚未提交，工作树就是答案。commit 之后工作树是干净的，同一
个问法会得到「什么都没改」，被 `select_components` 读成「不知道范围」，进而退化成 repo-wide 跑
**全部** component。后果不是慢一点：一个你根本没碰、却有存量 lint 错误的 component 会让 `post_commit` /
`pre_mr` 的 gate fail，而此时 commit 已经落地——push 和 MR 全被拦，改动本身却是好的。

所以范围是 `dispatch(phase, repo, paths=...)` 的入参，由 `commit_flow.phase_paths` 在相位
边界算好后**冻结**下传，每个相位问自己的那个 git 问题：

| 相位 | 「本次改动」是什么 | 怎么算 |
|---|---|---|
| `pre_commit` | **将要提交的**那些文件 | 有 `--file` → 展开该范围内的改动；没有 → 冻结工作树改动，再交给 normalize/checks |
| `post_commit` | 刚落地的那个 commit 自身 | `committed_paths`（`diff-tree --root`，根 commit 也能答） |
| `pre_mr` / `post_mr` | 整条分支 vs target（MR 承载的是整条分支，不是最后那个 commit） | `range_paths`（三点 `base...head`，避免把别人的提交算成你的） |

冻结还顺带解决一个并发问题：normalize 会改工作树，后续并发 checks 各自现算范围就可能得到
**不同**的集合。算一次、传下去，它们必然一致。

可重复的 `--file` 尤其要进 pre_commit 的范围：它是「工作树所有脏文件」的**子集**。拿超集当范围，会把你压根不打算提交的 component 拖进 gate——它有存量 lint 错误就拦掉你的 commit（与本表存在的理由同一类失败，只是换了扇门），且 normalize 会去改那些 component、改完又不进本次 commit，凭空搅脏工作树。故 staging 使用归一后的 scope，gate 再从同一 scope 展开真实 changed leaf files；`--file cli` 可以继续用于 staging，同时 test handler 能得到 `cli/tests/x.test.ts`，两边不会漂到 scope 之外。

### 范围与结果

repocli 按 Component 的 affectedFiles/testFiles 和 Makefile 文件过滤契约选择范围；没有契约或
删除、换归属、无法表示的路径保守回退全量。fix 允许改写内容，后续检查重新规划。
局部通过只放行本轮 inline gate，不建立全量检查引用。`run_validate.py --full` 显式请求全量。
缺少入口是 unavailable，不冒充成功；lint 失败或输入不一致阻断，test 失败保持 advisory。
`paths=[]` 表示没有改动，跳过；未知范围由相位基线或显式全量处理，不把读取失败解释为空选择。

### 相位 × hook 的非重复约定

`gcampr` 一次走 commit+push+MR，会触发 `pre_commit` 和 `pre_mr` 两个相位。把重活
（lint/test）放 `pre_commit`、`pre_mr` 留空，避免一次 gcampr 把 lint/test 跑两遍。
`pre_mr` 留给「MR 专属」检查（如 MR 描述完整性、或后续 e2e verdict）。

### signal hook 实例：code-review

code-review 是 signal hook（`scripts/domain/lifecycle/review.py` 的 `review`，返回带 `relay` 的 HookResult，
不在 subprocess 里跑 ocr）。**它是一个动作,挂哪个相位由 config 决定**;`commit_flow` detach 起
`run_review`,审 `origin/<target>..HEAD`,写 `.devloop/review.json`(通用交付,下一轮注入浮现)。
**机会性**:relay 跑时若分支有开放 MR(典型 `post_mr`,或往在途 MR 追加时),额外经 `forge.comment`
发评论到 MR 做历史。完整契约见 [`code-review.md`](./code-review.md)。

`launch_background_relays` 是通用的:任何相位 gate 产生的 relay 都在它所裹的 git 动作完成后
detach 起——pre/post_commit relays 在 commit 后、pre/post_mr relays 在 publish 后。

## Automatic validation scope

Repocli consumes current ComponentImpact tag counts and file lists, retains before/unowned
facts and reports full-scope fallback reasons. Devloop supplies phase baselines and requested
Components without another selection engine. No positive execution tags means skipped;
a selected Component with unsafe/deleted candidates or no file filtering contract uses full checks.
Malformed or unavailable analysis stops the round. Initial history without a comparison revision
uses explicit full selection. Check failures never trigger a second execution as an analysis fallback.

Missing lint/test targets are unavailable and non-blocking in devloop, but never passing evidence.
No language-specific runner is inferred. Input inconsistency or actual lint failure blocks the gate;
test failures remain advisory. Scope and diagnostics are projected from the original report to Board.

## Candidate and validation evidence

`pre_commit` checks run after normalization. Before installing the staged index, the
commit workflow requires its paths, file bytes, modes and gitlink OIDs to match the
checked working tree, and rechecks the content identity before committing. A partial
selection that omits another changed input is rejected; include that input or validate
in a separate clean checkout. Rejection during staging preserves the original index,
including partial hunks. Git clean filters that transform checked bytes are rejected.
The workflow does not stash, reset, or execute project checks under Git's index lock.

Each checkout/Component/check owns one latest execution record in `validation_results`:
source identity, command, scope, selected files, hashed process environment, dependency
witnesses, result and original execution time. Only identical successful inputs can be
reused. Dependencies observed as `present`, unpreparable `missing`, or otherwise unknown
may still enter actual project checks under the preparation policy, but cannot authorize
reuse. Managed installations use repocli's receipt and dependency-input witnesses; this
is an installation contract, not a byte-integrity scan of all installed dependencies.
Repocli checks source and receipt inputs again after execution; changes invalidate the result.

Branch `lint`/`test` segments contain references to these records, not independent pass
stamps. Full-check reuse binds the current branch to the original execution time.
Focused/explicit checks cannot grant a full-Component pass; failed or replaced evidence
invalidates old references. Python context and TypeScript Board resolve the same evidence
contract. Board reports historical execution; the raw-commit guard additionally requires
current source, dependency witnesses and a complete index. It does not compare the Harness
process environment to the frozen check environment or decide execution reuse. Unsupported
report formats never grant permission.

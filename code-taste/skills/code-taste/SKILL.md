---
name: code-taste
description: "Use when writing, modifying, refactoring, or reviewing software code; designing models, module boundaries, interfaces, or names; or writing README, AGENTS.md, design documents, and technical blog posts. Includes Go, Python, and TypeScript conventions. Skip read-only debugging, triage, call-path inspection, and operational execution; apply when the task moves into code changes."
---

# Code Taste

个人代码品味，重点约束**判断力**而不是语法风格。

## 适用范围

**用本 skill**：编写新代码 / 涉及结构判断的补丁 / 重构；做方案设计、模块拆分、接口设计；review 代码、评估坏味道、判断是否该抽象；定期回看近期 merged MR / 提交序列，识别补丁背后反复缺失的概念（自底向上迭代，沉淀进 `references/examples/`，一案例一文件）。

**先别来本 skill**：

- 核心是“为什么坏了 / 哪里报错 / 线上现象怎么定位” → 使用项目对应的 debugging / trace 能力，证据不足时不要先下结构结论。
- 核心是“要不要新增功能、功能怎么设计”且需求还没稳 → 先澄清原始需求和约束。
- 已有明确设计 / 计划 → 本 skill 只检查复杂度和边界，不替代执行型 skill。

## 按问题读取：理念、评审、语言与案例

### [模型：核心对象是什么、新概念是否成立](references/modeling.md)

### [模块化：职责归属、内聚、耦合与复用](references/modularity.md)

- 判断入口、Service / Biz、Repository 与 DAO 的职责，或是否需要独立 Domain：看 [按需的数据访问契约](references/modularity.md#repository按需表达业务的数据需求)。

### [行为：控制流、函数职责与正确性](references/behavior.md)

### [演进：绿地视角、长期方向与 MR 复盘](references/evolution.md)

### [表达：命名、文档、注释与日志](references/expression.md)

#### 业务概念、类型、函数与变量：命名

- 纠结命名、抽象命名不顺：看 [命名原则](references/expression.md#命名)

#### README / AGENTS.md / 设计文档 / Blog / 代码注释：写作

- 编写或整理 README、AGENTS.md、设计文档、Blog、代码注释：看 [文档分层与写作原则](references/expression.md#文档与写作)；
  AGENTS.md 的代码地图默认使用 tree 风格

#### 行为契约、领域不变量、设计理由与临时措施：意图标记

- 修改行为契约、领域不变量或非显而易见的设计意图：看 [结构化意图标记](references/mark.md)

### 设计、评审与复盘

- 做架构判断、模块拆分、接口设计：从 [架构判断入口](references/README.md) 按问题路由
- 做架构 review 或逐项检查设计质量：看 [架构 Review](references/review.md#架构评审)
- 回看近期 MR 做设计复盘：看 [MR 序列复盘](references/evolution.md#mr-序列复盘)

#### [代码实现评审](references/review.md#代码评审流程)

- 做代码 review 或逐项检查实现质量：看 [代码 Review](references/review.md#代码评审流程)

### Go / Python / TypeScript：编写或修改代码的语言基线

- 涉及 Go、Python 或 TypeScript 代码：读取
  [语言专项约定入口](references/language/README.md)并只加载对应语言文件；这是执行基线，不改变
  T0/T1/T2 定档

### 具体反例与正例：查阅及积累

- 积累 / 查反例正例案例：看 [案例索引](references/examples/README.md)（一案例一文件；加案例拷 `_TEMPLATE.md`、补索引）

## 按语义变化控制设计深度

判断力 skill 的头号失败模式是**对琐碎改动过度上设计脑**。所以先定档，再决定起多少、读哪层深度。

**定档**（决定起多少设计脑）：

| 档 | 什么改动 | 起多少 |
|----|----------|--------|
| **T0 琐碎** | 不涉及新的语义判断，主要是配置值、版本号、文案、格式或机械重命名等改动 | 不起设计脑，优先直接改；最多扫常驻项——命名是否表意、日志 / 错误是否带上下文 |
| **T1 局部** | 在既有大概念和边界内，调整行为，或设计 / 调整局部小概念、类型与流程 | 局部设计 + 代码 review——确认 owner 不变，再看正确性、可读性、命名、函数层级与日志（见 [代码 Review](references/review.md#代码评审流程)） |
| **T2 结构** | 改变顶层概念、owner、模块边界、依赖方向、跨边界契约或广泛引用的公共符号 | 完整设计脑——模型 / 边界 / 依赖 / 接口（从 [架构判断入口](references/README.md) 进入） |

不同档位使用不同的主要观察尺度：

- **T2：系统 = 核心概念 + 主流程**。核心概念落实到代码，通常由 interface、protocol、struct / class
  等符号表达；承载身份、粒度、生命周期或策略选择的核心常量与配置，也是核心设计的代码落点。
  主流程落实到拥有协作顺序与生命周期契约的函数、方法或编排入口。这些概念与流程的代码落点，
  尽量用 [marker](references/mark.md) 保存仅靠实现难以还原的契约与设计理由，让阅读路径形成
  “局部改动 → 所依赖的核心符号 → marker → 相关系统约束 / 核心设计”，为单次改动带入全局视角。
  先判断顶层概念、owner、边界及其协作关系。每个系统都应能用“一句话”串起核心概念与主流程；
  它是当前系统模型的最小摘要，应随项目演进持续校准、逐步清晰。
  这套模型及其关键设计理由，在存在稳定共享内核时由 [kernel.md](references/expression.md#可选的-docskernelmd) 展开。
- **T1 及以下：程序 = 数据结构 + 算法；代码 = 控制 + 逻辑**，在既有边界内判断数据如何表达、行为
  如何实现，以及执行顺序与业务规则是否清楚分离。

> 档由改动的**语义变化与影响层级**决定，不由行数、文件数或是否新增类型决定：百行机械 rename 仍是
> T0；大概念内部新增私有类型或接口可以是 T1；5 行修改若改变跨边界契约也应是 T2。

意图标记也随档位增量判断：T0 通常不新增，但不能让已有 mark 与代码失真；T1 的 bugfix、行为分支和
局部契约变化检查 `spec` / `why` / `rule`；T2 的接口、模型和边界变化检查 `spec` / `why` / `ideal` /
`rule` / `link`。涉及临时措施时检查 `tmp`，只有具体验证场景值得长期寻址或复用时才补 `case`。
详细判断见 [结构化意图标记](references/mark.md)。

## 设计判断的出发点

先控制复杂度，再实现功能；先把模型、边界和命名想清楚，再进入实现细节。
从第一性原理出发，先追问原始问题和原始需求到底是什么，再讨论方案、抽象和实现。

开工前，以有独立判断的协作者身份，通过关键提问和必要的资料阅读，与用户厘清目标、约束、边界和完成标准。提问不仅补齐信息，也要帮助用户审视假设、明确取舍；有不同判断时，说明依据。等整体脉络清晰后，给出与任务复杂度匹配的方案。

把用户也视为重要的信息源。对目标、背景、约束或取舍有疑问时，主动向用户求证，不要默默猜测后继续推进；能自行查明的事实先查，仍会影响行动方向的不确定点及时提出。

## 输出约定

- 设计类：先输出问题模型、边界、关键取舍，再给建议方案；不要一上来铺实现细节
- review 类：findings first，按严重度或破坏性排序，摘要放后面；T2 先做架构 review，再做代码 review
- 重构类：先说明哪些逻辑应归并、迁移或拆分，以及如何降低理解和修改成本，再进入代码修改
- 命中小改动（T0）时，回答保持简洁，不把结果写成架构评审报告
- 如果给出结论，必须能落到模型、边界、依赖、命名或日志上下文中的至少一个具体点
- 设计 / 方案 review 按“原始需求 → 主要备选 → 选择及原因 → 主要改动 → 对既有设计的影响”组织。
- 涉及行为或结构变化时，交付说明本次新增、更新或无需更新意图标记的判断。

## 需要复核的信号

- 用技术实现名替代业务概念，例如 `xxxMap`、`manager`、`processor`
- Request/DTO/ORM 对象直接穿透到核心业务层
- 一个函数同时混合业务规则、流程控制、协议细节和持久化细节
- 为了复用而抽象，结果抽出一个接口复杂、语义模糊的浅模块
- 没先搜一下就当场手写一套系统里已存在的能力（base64 编解码、None 安全访问、分页、HTTP client、时间解析…），仓库因此沉淀出多套近似实现
- 错误信息只说失败，不说哪个参数、什么值、在做什么操作

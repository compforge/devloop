---
name: code-taste
description: "Code taste and software design judgment: solution/design review, module & interface boundary shaping, refactoring tradeoffs, naming, maintainability, and documentation layering. First-principles: clarify the original requirement before discussing solutions. Skip for debugging, triage, call-path inspection, or routine small edits."
---

# Code Taste

个人代码品味，重点约束**判断力**而不是语法风格。

## Overview

先控制复杂度，再实现功能；先把模型、边界和命名想清楚，再进入实现细节。
从第一性原理出发，先追问原始问题和原始需求到底是什么，再讨论方案、抽象和实现。

## 何时用 · 先定档

判断力 skill 的头号失败模式是**对琐碎改动过度上设计脑**。所以先定档，再决定起多少、读哪层深度。

**用本 skill**：编写新代码 / 涉及结构判断的补丁 / 重构；做方案设计、模块拆分、接口设计；review 代码、评估坏味道、判断是否该抽象；定期回看近期 merged MR / 提交序列，识别补丁背后反复缺失的概念（自底向上迭代，沉淀进 `references/examples/`，一案例一文件）。

**先别来本 skill**：

- 核心是“为什么坏了 / 哪里报错 / 线上现象怎么定位” → 使用项目对应的 debugging / trace 能力，证据不足时不要先下结构结论。
- 核心是“要不要新增功能、功能怎么设计”且需求还没稳 → 先澄清原始需求和约束。
- 已有明确设计 / 计划 → 本 skill 只检查复杂度和边界，不替代执行型 skill。

**定档**（决定起多少设计脑）：

| 档 | 什么改动 | 起多少 |
|----|----------|--------|
| **T0 琐碎** | 不涉及新的语义判断，主要是配置值、版本号、文案、格式或机械重命名等改动 | 不起设计脑，优先直接改；最多扫常驻项——命名是否表意、日志 / 错误是否带上下文 |
| **T1 局部** | 在既有大概念和边界内，调整行为，或设计 / 调整局部小概念、类型与流程 | 局部设计 + 代码 review——确认 owner 不变，再看正确性、可读性、命名、函数层级与日志（见 [[/references/code/review|代码 Review]]） |
| **T2 结构** | 改变顶层概念、owner、模块边界、依赖方向、跨边界契约或广泛引用的公共符号 | 完整设计脑——模型 / 边界 / 依赖 / 接口（从 [[/references/architecture/README|架构判断入口]] 进入） |

不同档位使用不同的主要观察尺度：

- **T2：系统 = 核心概念 + 主流程**，先判断顶层概念、owner、边界及其协作关系。
- **T1 及以下：程序 = 数据结构 + 算法；代码 = 控制 + 逻辑**，在既有边界内判断数据如何表达、行为
  如何实现，以及执行顺序与业务规则是否清楚分离。

> 档由改动的**语义变化与影响层级**决定，不由行数、文件数或是否新增类型决定：百行机械 rename 仍是
> T0；大概念内部新增私有类型或接口可以是 T1；5 行修改若改变跨边界契约也应是 T2。

意图标记也随档位增量判断：T0 通常不新增，但不能让已有 mark 与代码失真；T1 的 bugfix、行为分支和
局部契约变化检查 `spec` / `rule`；T2 的接口、模型和边界变化检查 `spec` / `rule` / `link`，只有具体验证
场景值得长期寻址或复用时才补 `case`。详细判断见 [[mark|结构化意图标记]]。

## Core Rules

- 先判断原始问题是业务问题还是技术问题，不要直接掉进实现细节。
- 新概念只有具备独立身份、owner、生命周期、行为或契约，且能压缩多处事实或决策时才成立；
  字段、事件、持久化记录和 UI 投影可以有清晰类型，但不要因此自动进入核心词汇（见
  [[/references/architecture/modeling#什么值得进入模型|概念与实现细节]]）。
- 用绿地视角判断新需求是增加 case 还是旧模型已经失效，并用真实的长期方向校准当前边界（见 [[/references/architecture/modeling#绿地视角|绿地视角]]、[[/references/architecture/evolution#长期方向|长期方向]]）。
- 保持演进视角：单次需求允许局部闭环，但要周期性回看需求与 MR 序列，判断核心概念和流程是开始
  成型、仍然成立还是尚需保持松散，并让代码与文档组织随真实模型演进（见
  [[/references/architecture/evolution#MR 序列复盘|MR 序列复盘]]）。
- 核心业务依赖稳定抽象，不依赖外部协议、框架和存储细节（见 [[/references/architecture/boundaries|边界与依赖]]）。
- 重要约束应按违反代价升级为结构、契约测试或运行时对账，不能只靠文档自觉（见 [[/references/architecture/evolution#约束机制化|约束机制化]]）。
- 修改行为契约、领域不变量、非显而易见的设计原因或容易被误改的约定时，判断是否应把诉求作为
  结构化意图标记绑定到稳定 symbol；不要标记可从代码直接读出的事实，也不要为了完整性强行补 `case`
  （见 [[mark|结构化意图标记]]）。
- 实现通用逻辑前先勘探框架、common、utils 和近邻实现，复用判断前置于实现（见 [[/references/architecture/maintainability#复用判断|复用判断]]）。
- 阅读者体验优先；命名要表达真实问题和边界（见 [[/references/code/naming|命名原则]]），日志和错误必须带上下文。

## Output Contract

- 设计类：先输出问题模型、边界、关键取舍，再给建议方案；不要一上来铺实现细节
- review 类：findings first，按严重度或破坏性排序，摘要放后面；T2 先做架构 review，再做代码 review
- 重构类：先说明准备如何收敛复杂度、准备怎么拆，再进入代码修改
- 命中小改动（T0）时，回答保持简洁，不把结果写成架构评审报告
- 如果给出结论，必须能落到模型、边界、依赖、命名或日志上下文中的至少一个具体点
- 设计 / 方案 review 按“原始需求 → 主要备选 → 选择及原因 → 主要改动 → 对既有设计的影响”组织。
- 涉及行为或结构变化时，交付说明本次新增、更新或无需更新意图标记的判断。

## Quick Entry

- 涉及 Go、Python 或 TypeScript 代码：读取
  [[/references/language/README|语言专项约定入口]]并只加载对应语言文件；这是执行基线，不改变
  T0/T1/T2 定档
- 做架构判断、模块拆分、接口设计：从 [[/references/architecture/README|架构判断入口]] 按问题路由
- 回看近期 MR 做设计复盘：看 [[/references/architecture/evolution#MR 序列复盘|MR 序列复盘]]
- 做架构 review 或逐项检查设计质量：看 [[/references/architecture/review|架构 Review]]
- 做代码 review 或逐项检查实现质量：看 [[/references/code/review|代码 Review]]
- 纠结命名、抽象命名不顺：看 [[/references/code/naming|命名原则]]
- 修改行为契约、领域不变量或非显而易见的设计意图：看 [[mark|结构化意图标记]]
- 编写或整理 README、AGENTS.md、设计文档、代码注释：看 [[document|文档分层与写作原则]]；
  AGENTS.md 的代码地图默认使用 tree 风格
- 积累 / 查反例正例案例：看 [[/references/examples/README|案例索引]]（一案例一文件；加案例拷 `_TEMPLATE.md`、补索引）

## Red Flags

- 用技术实现名替代业务概念，例如 `xxxMap`、`manager`、`processor`
- Request/DTO/ORM 对象直接穿透到核心业务层
- 一个函数同时混合业务规则、流程控制、协议细节和持久化细节
- 为了复用而抽象，结果抽出一个接口复杂、语义模糊的浅模块
- 没先搜一下就当场手写一套系统里已存在的能力（base64 编解码、None 安全访问、分页、HTTP client、时间解析…），仓库因此沉淀出多套近似实现
- 错误信息只说失败，不说哪个参数、什么值、在做什么操作

# 结构化意图标记

结构化意图标记（mark）是绑定到代码 symbol 的结构化注释，用来保存仅靠实现难以稳定还原、但后续
修改必须理解的契约、设计理由、理想形态、临时措施及退出条件、维护约束。它让意图与 owner 共置，
并支持搜索、追溯和机检。

Vibe coding 中，AI 容易围绕眼前代码作局部判断，尤其在漏读设计文档时偏离整体约束。Marker 为
代码阅读补充上下文：`spec` 保存契约，`why` 保存理由，`link` 显式连接相关文档、代码与外部资产。
把这些信息挂在[核心概念与主流程的代码落点](../SKILL.md#按语义变化控制设计深度) 上，让 AI 从当前符号沿链接
追溯相关依据，为局部修改补上系统背景，而不依赖它主动发现所有文档。

mark 的首要价值是增强注释，延续上一次开发形成的关键判断。`specgen` 只是可选的提取与机检工具，
既不是引入 marker 的目的，也不决定一条决策是否值得保留。

## 目录

- [何时标记](#何时标记)
- [标记语义](#标记语义)
- [与代码、文档和测试的边界](#与代码文档和测试的边界)
- [挂载点与生命周期](#挂载点与生命周期)
- [spec-case 写法](#spec-case-写法)
- [反模式](#反模式)

## 何时标记

修改代码时先判断是否产生 **intent delta**：行为契约、领域不变量、设计理由或维护约束是否变化。
以下信息值得标记：

- 公共接口、行为承诺，以及签名没有表达的调用限制。
- 状态流转、顺序依赖、一致性边界等容易在重构中被破坏的不变量。
- 为避免真实失败模式而作出的非显而易见选择。
- 当前实现受既有限制而将就，但已存在稳定、值得后续改动逐步收敛的绿地目标。
- 当前措施是临时的，需要防止后续修改把它误当成长期设计；退出条件可在明确后补充。
- 缺陷修复后值得长期保留、供修改和 review 使用的防回归诉求。
- 需要从代码稳定寻址到设计文档、相关 symbol 或验证资产的关系。

不标记可从类型或局部实现直接读出的事实；普通 getter、简单转发、机械 glue 和生成代码通常也不需要。
判断标准不是 symbol 是否重要，而是下一位作者只读实现时，是否可能合理地误解或破坏其诉求。

意图标记随改动档位增量判断：

- T0 通常不新增；如果改动触及已有 mark 描述的事实，必须同步更新。
- T1 的 bugfix、行为分支和局部契约变化重点检查 `spec` / `why` / `rule`；T1 / T2 涉及临时措施时检查 `tmp`。
- T2 的接口、模型和边界变化重点检查 `spec` / `why` / `ideal` / `rule` / `link`；只有验证场景值得长期寻址或复用时才补 `case`。

## 标记语义

- `spec`：代码必须保证什么。
- `why`：代码已经展示 how 时，为什么选择当前结构、顺序或边界，以及它避免了什么失败模式；可以不依附 `spec` 独立存在。
- `ideal`：摆脱当前限制后应收敛到的理想形态；不是 TODO、排期或路线图承诺，可以不依附 `spec` 独立存在。
- `tmp`：当前临时保留的措施（`text` 必填），可附可验证的退出条件（`until` 选填）；可以不依附 `spec` 独立存在。
- `rule`：后续修改或评审必须留意的约束和失败模式。
- `link`：解释诉求的设计上下文、相关 symbol 或外部资产。
- `case`：值得独立寻址、复用或交给 harness 执行的具体验证场景；默认不是必填项。

mark 保存后续修改仍需理解的意图；`tmp` 写当前措施及已知的退出条件，不记录某次 MR 的迁移流水账。
一个 mark 表达一个中心意图；不同 owner 或生命周期的意图分别挂到各自 symbol，不用一段自由文本打包。`why` 是解释，不是 `spec`，也不是要求
reviewer 执行动作的 `rule`。`ideal` 只在当前确有将就且目标形态稳定时使用，不为每个实现虚构绿地版本；
`tmp` 标明临时措施，退出条件明确时用 `until` 补充，`why` 解释选择原因，`ideal` 描述目标形态；按需要组合，
不要求每个临时措施都有 `ideal`。跨多个 symbol 的长篇设计仍由设计文档或 ADR 承载，mark 只保留摘要。

## 与代码、文档和测试的边界

- 代码和类型表达可直接执行或检查的约束。
- 行注释 / docstring 解释只在局部实现内成立的顺序依赖、调用方式和临近上下文；需要绑定到稳定
  symbol、供后续修改追溯或机检的设计理由写成 `why`。
- mark 保存绑定到稳定 symbol、需要追溯或机检的意图。
- 设计文档解释跨 symbol 的模型、边界和长期取舍；mark 用 `link` 指向它。
- 测试和 harness 证明行为；mark 保存行为背后的诉求。

不要为了使用 spec-case 给每个 `spec` 凑 `case`。违反代价高的 `rule` 还应固化为类型、接口、契约测试、
运行时校验或对账；mark 本身不等于约束已执行。

## 挂载点与生命周期

把 mark 挂在真正拥有相应契约、理由、理想形态、临时措施或约束的最小稳定 symbol 上，不挂在碰巧实现它的
helper、adapter 或调用点。类型级不变量、理由和理想形态挂到类型，操作契约、理由和理想形态挂到
方法或函数；跨 symbol 的设计由文档拥有，各 symbol 只保留稳定摘要和可寻址 link。

symbol-id 默认从语言符号生成；overload 或语言映射导致声明碰撞时，显式指定稳定 id。手动 id 是身份
覆盖而非展示名称，重命名或移动代码时应保持不变。

重命名、移动、拆分或合并 symbol 时，同步判断 mark 的 owner 是否改变；删除代码时也要删除或迁移
mark，避免机器可读资产保留失效意图。

修改带 `tmp` 的 symbol 时，若有 `until`，检查条件是否已有证据成立，再判断移除或替换措施并同步
清理 marker。未填 `until` 时保留临时性声明，不编造退出条件或据此直接删除；条件明确后可补充。`tmp` 不自动执行清理，不豁免当前
`spec`，未标记代码也不因此被判定为永久方案。

`specgen` 只由用户明确触发。新增或修改 mark 后，可以提示生成资产可能漂移并询问是否执行，但不得
自动运行或顺带更新生成资产。用户暂不触发时，marker 仍作为结构化注释生效，无需额外引入生成步骤；
项目若配置相关门禁，应如实报告 drift 风险。

## spec-case 写法

[`spec-case`](https://github.com/compforge/spec-case) 可把多语言代码中的 AI-native marker 抽取为
机器可读的 `spec.json`。以下示例表达同一组结构化意图。

`tmp` 的 `text` 使用非空字面量，`until` 选填。`text` 缺失、空白或无法静态解析时忽略 marker；
`until` 未填、空白或无法静态解析时只省略该字段，保留措施描述。有效条目按源码顺序投影到
`specs[].tmps`；`specgen --check` 可检测字段变化。

最小写法只需措施描述，例如 Python `@tmp("保留旧存储双写")`、TypeScript
`@Tmp("保留旧存储双写")`；Go / Rust 注释省略 `,until=...` 即可。

### Go

```go
// CreateNotebook 创建 notebook。
//
// +spec=`tenant/user header 必填；同名 notebook 不可重复创建`
// +case:id=duplicate_name,desc=`重复创建`,expect=`409`,forbid=`写入第二条记录`
// +why=`数据库唯一约束是多副本写入的最终权威`
// +ideal=`移除兼容双写，由单一持久化 owner 负责`
// +tmp:text=`保留旧存储双写`,until=`所有受支持的读取方均已切换到新存储`
// +link=component://docs/tenancy.md
// +rule=`请求热路径，评审时留意新增的同步 DB 调用`
func (s *Service) CreateNotebook(ctx context.Context, req *CreateReq) (*Notebook, error) {
    // ...
}
```

### Python

```python
from spec_case import case, ideal, link, rule, spec, tmp, why


@spec("tenant/user header 必填；同名 notebook 不可重复创建")
@case("duplicate_name", "重复创建", expect="409", forbid="写入第二条记录")
@why("数据库唯一约束是多副本写入的最终权威")
@ideal("移除兼容双写，由单一持久化 owner 负责")
@tmp("保留旧存储双写", until="所有受支持的读取方均已切换到新存储")
@link("component://docs/tenancy.md")
@rule("请求热路径，评审时留意新增的同步 DB 调用")
async def create_notebook(req: CreateRequest) -> Notebook:
    ...
```

### TypeScript

Class 和 method 使用 `Spec`、`Case`、`Why`、`Ideal`、`Tmp`、`Link`、`Rule` decorator：

```typescript
import { Case, Ideal, Link, Rule, Spec, Tmp, Why } from "@compforge/spec-case";

@Spec("NotebookService 的所有写操作必须保持 tenant 隔离")
export class NotebookService {
  @Spec("tenant/user header 必填；同名 notebook 不可重复创建")
  @Case("duplicate_name", "重复创建", { expect: "409", forbid: "写入第二条记录" })
  @Why("数据库唯一约束是多副本写入的最终权威")
  @Ideal("移除兼容双写，由单一持久化 owner 负责")
  @Tmp("保留旧存储双写", { until: "所有受支持的读取方均已切换到新存储" })
  @Link("component://docs/tenancy.md")
  @Rule("请求热路径，评审时留意新增的同步 DB 调用")
  async createNotebook(req: CreateRequest): Promise<Notebook> {
    // ...
  }
}
```

普通 function、function-valued variable、type / interface 等没有统一 decorator 位置的 symbol 使用
JSDoc marker，不要为了挂 mark 改写成 class：

```typescript
/**
 * @spec tenant/user header 必填；同名 notebook 不可重复创建
 * @case id=duplicate_name,desc=`重复创建`,expect=`409`,forbid=`写入第二条记录`
 * @why 数据库唯一约束是多副本写入的最终权威
 * @ideal 移除兼容双写，由单一持久化 owner 负责
 * @tmp text=`保留旧存储双写`,until=`所有受支持的读取方均已切换到新存储`
 * @see {@link component://docs/tenancy.md}
 * @rule 请求热路径，评审时留意新增的同步 DB 调用
 */
export async function createNotebook(req: CreateRequest): Promise<Notebook> {
  // ...
}
```

### Rust

Rust 的 `tmp` 使用 doc-comment，与 Go 的参数写法相同：

```rust
/// +tmp:text=`保留旧存储双写`,until=`所有受支持的读取方均已切换到新存储`
pub fn create_notebook() {
    // ...
}
```

## 反模式

- 追求 symbol 覆盖率，批量生成没有判断价值的 mark。
- 用 mark 复述函数名、类型、字段和当前实现步骤。
- 用 `why` 重述实现已经清楚表达的 how，或记录只对一次 MR 有意义的迁移原因。
- 用 `ideal` 代替真正的迁移任务、排期或承诺，或为没有明确绿地目标的代码编造理想形态。
- `tmp` 的 `text` 只写“临时方案”而不说明措施，或为了填满字段把 `until` 写成“以后优化”；退出条件未知时直接省略。
- 仅凭存在 `tmp` 就删除实现，或用它为违反当前 `spec` 开脱。
- 每个 `spec` 强行配一个 `case`，把示例数量误当成意图质量。
- 把长篇设计文档塞进 mark，而不是保留稳定摘要和 link。
- 把 mark 当成约束已经执行，不补必要的类型、测试或运行时机制。
- mark 挂在临时 helper 或 adapter，真正的契约 owner 变化后内容随即失联。

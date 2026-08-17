# 结构化意图标记

结构化意图标记（mark）是绑定到代码 symbol 的结构化注释，用来保存仅靠实现难以稳定还原、但后续
修改必须理解的关键决策。它让意图与 owner 共置，并支持搜索、追溯和机检。

mark 的首要价值是增强注释，延续上一次开发形成的关键判断。`specgen` 只是可选的提取与机检工具，
既不是引入 marker 的目的，也不决定一条决策是否值得保留。

## 目录

- [[#何时标记]]
- [[#标记语义]]
- [[#与代码、文档和测试的边界]]
- [[#挂载点与生命周期]]
- [[#spec-case 写法]]
- [[#反模式]]

## 何时标记

修改代码时先判断是否产生 **intent delta**：行为契约、领域不变量、设计理由或维护约束是否变化。
以下信息值得标记：

- 公共接口、行为承诺，以及签名没有表达的调用限制。
- 状态流转、顺序依赖、一致性边界等容易在重构中被破坏的不变量。
- 为避免真实失败模式而作出的非显而易见选择。
- 缺陷修复后值得长期保留、供修改和 review 使用的防回归诉求。
- 需要从代码稳定寻址到设计文档、相关 symbol 或验证资产的关系。

不标记可从类型或局部实现直接读出的事实；普通 getter、简单转发、机械 glue 和生成代码通常也不需要。
判断标准不是 symbol 是否重要，而是下一位作者只读实现时，是否可能合理地误解或破坏其诉求。

意图标记随改动档位增量判断：

- T0 通常不新增；如果改动触及已有 mark 描述的事实，必须同步更新。
- T1 的 bugfix、行为分支和局部契约变化重点检查 `spec` / `rule`。
- T2 的接口、模型和边界变化重点检查 `spec` / `rule` / `link`；只有验证场景值得长期寻址或复用时才补 `case`。

## 标记语义

- `spec`：代码必须保证什么，以及契约为何存在。
- `rule`：后续修改或评审必须留意的约束和失败模式。
- `link`：解释诉求的设计上下文、相关 symbol 或外部资产。
- `case`：值得独立寻址、复用或交给 harness 执行的具体验证场景；默认不是必填项。

mark 只写稳定诉求，不记录某次 MR 的迁移过程。一个 mark 表达一个中心意图；不同 owner 或生命周期
的诉求分别挂到各自 symbol，不用一段自由文本打包。

## 与代码、文档和测试的边界

- 代码和类型表达可直接执行或检查的约束。
- 行注释 / docstring 解释局部顺序依赖、调用方式和实现附近的 why。
- mark 保存绑定到稳定 symbol、需要追溯或机检的意图。
- 设计文档解释跨 symbol 的模型、边界和长期取舍；mark 用 `link` 指向它。
- 测试和 harness 证明行为；mark 保存行为背后的诉求。

不要为了使用 spec-case 给每个 `spec` 凑 `case`。违反代价高的 `rule` 还应固化为类型、接口、契约测试、
运行时校验或对账；mark 本身不等于约束已执行。

## 挂载点与生命周期

把 mark 挂在真正拥有契约的最小稳定 symbol 上，不挂在碰巧实现它的 helper、adapter 或调用点。
类型级不变量挂到类型，操作契约挂到方法或函数；跨 symbol 的设计由文档拥有，各 symbol 只保留
可寻址 link。

symbol-id 默认从语言符号生成；overload 或语言映射导致声明碰撞时，显式指定稳定 id。手动 id 是身份
覆盖而非展示名称，重命名或移动代码时应保持不变。

重命名、移动、拆分或合并 symbol 时，同步判断 mark 的 owner 是否改变；删除代码时也要删除或迁移
mark，避免机器可读资产保留失效意图。

`specgen` 只由用户明确触发。新增或修改 mark 后，可以提示生成资产可能漂移并询问是否执行，但不得
自动运行或顺带更新生成资产。用户暂不触发时，marker 仍作为结构化注释生效，无需额外引入生成步骤；
项目若配置相关门禁，应如实报告 drift 风险。

## spec-case 写法

[`spec-case`](https://github.com/compforge/spec-case) 可把多语言代码中的 AI-native marker 抽取为
机器可读的 `spec.json`。以下示例表达同一份契约。

### Go

```go
// CreateNotebook 创建 notebook。
//
// +spec=`tenant/user header 必填；同名 notebook 不可重复创建`
// +case:id=duplicate_name,desc=`重复创建`,expect=`409`,forbid=`写入第二条记录`
// +link=docs/tenancy.md
// +rule=`请求热路径，评审时留意新增的同步 DB 调用`
func (s *Service) CreateNotebook(ctx context.Context, req *CreateReq) (*Notebook, error) {
    // ...
}
```

### Python

```python
from spec_case import case, link, rule, spec


@spec("tenant/user header 必填；同名 notebook 不可重复创建")
@case("duplicate_name", "重复创建", expect="409", forbid="写入第二条记录")
@link("docs/tenancy.md")
@rule("请求热路径，评审时留意新增的同步 DB 调用")
async def create_notebook(req: CreateRequest) -> Notebook:
    ...
```

### TypeScript

Class 和 method 使用 `Spec`、`Case`、`Link`、`Rule` decorator：

```typescript
import { Case, Link, Rule, Spec } from "@compforge/spec-case";

@Spec("NotebookService 的所有写操作必须保持 tenant 隔离")
export class NotebookService {
  @Spec("tenant/user header 必填；同名 notebook 不可重复创建")
  @Case("duplicate_name", "重复创建", { expect: "409", forbid: "写入第二条记录" })
  @Link("docs/tenancy.md")
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
 * @see {@link ./docs/tenancy.md}
 * @rule 请求热路径，评审时留意新增的同步 DB 调用
 */
export async function createNotebook(req: CreateRequest): Promise<Notebook> {
  // ...
}
```

## 反模式

- 追求 symbol 覆盖率，批量生成没有判断价值的 mark。
- 用 mark 复述函数名、类型、字段和当前实现步骤。
- 每个 `spec` 强行配一个 `case`，把示例数量误当成意图质量。
- 把长篇设计文档塞进 mark，而不是保留稳定摘要和 link。
- 把 mark 当成约束已经执行，不补必要的类型、测试或运行时机制。
- mark 挂在临时 helper 或 adapter，真正的契约 owner 变化后内容随即失联。

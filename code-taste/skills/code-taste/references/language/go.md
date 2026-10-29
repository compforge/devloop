# Go/Golang

## 默认技术选择

- 使用 Go Modules；项目目录不依赖 GOPATH 的 `src` 布局。
- DB 访问默认使用 GORM；除非项目已有其它稳定选择，不为局部需求引入第二套 ORM。
- 结构化日志默认使用标准库 `log/slog`；若项目已统一使用 `zap` 或 `zerolog`，沿用现有日志栈，不为局部改动引入第二套。

## 项目布局与包可见性

目录首先表达二进制、组件 owner 和公共 API 边界，不机械套用一套水平分层模板。

- `cmd/<binary>/` 是二进制入口，只负责配置加载、依赖组装、生命周期和进程信号，不承载业务逻辑。
- 不需要被仓库外导入的应用实现默认放在 `internal/<component>/`。
- 位于仓库根或其它 `internal` 之外的 package，意味着有意向仓库外提供 Go API，并承担兼容性和文档
  责任；不要只为让 `cmd` 可导入就创建顶层 package。
- 多二进制仓库先按进程或组件划分 owner，再在组件内部分层；多个组件共享但不公开的代码放根
  `internal/`。当组件间需要编译器强制隔离时，可以在组件下使用嵌套 `internal/` 缩小导入范围。
- 避免 `{module}/{module}` 这类重复导入路径；仅供本仓库二进制使用的实现包放入 `internal/`，不要以
  顶层公共 package 暴露。

单服务 CRUD 项目可以参考以下布局；`domain/`、`repo/` 按复杂度与封装价值引入，简单场景保留 Service / Biz 直接使用 DAO、client 的结构即可（见 [Repository 的按需边界](../modularity.md#repository按需表达业务的数据需求)）：

```text
{project}/
├── cmd/
│   └── {project}/main.go       # 程序入口与 composition root
├── internal/
│   ├── api/
│   │   └── <domain>.go         # 某领域的 HTTP handler 与 API view model
│   ├── service/
│   │   └── <domain>.go         # 某领域的用例编排、事务与跨对象一致性
│   ├── domain/
│   │   └── <domain>.go         # 领域对象、不变量和纯业务行为
│   ├── model/
│   │   └── <domain>.go         # PO：数据库映射与持久化形状
│   ├── repo/
│   │   ├── <domain>.go         # 某领域需要的存储契约
│   │   └── gorm/
│   │       └── <domain>.go     # GORM 实现及 PO ↔ domain 转换
│   ├── db/                     # 数据库连接、事务与方言适配
│   ├── config/                 # 配置加载
│   └── {其他集成}/             # 如 k8s/、cache/ 等外部系统适配
├── migrations/                # SQL migration 文件与迁移执行资源
├── build/                     # Dockerfile
├── manifests/                 # Helm Chart
├── Makefile                   # 项目标准开发、验证与构建入口
└── .env.example               # 使用环境变量配置时提供
```

在单服务 CRUD 中，`api/`、`service/`、`model/`、`repo/` 通常先按各层负责的领域概念
组织为一个 `<domain>.go`。这只是各层内部的常见文件组织方式，不表示不同层的 domain 必须一一
对应：一个 service 用例可以协调多个 domain，一个 domain 也可以拆成多个 API view、PO 或
repository 实现；应按该层的真实职责拆分，而不是为了文件名对齐强行保持同构。

View Model 按需提取到 `view/`，同样按领域组织为一个 `<domain>.go`（如 `view/message.go`、
`view/conversation.go`），避免集中进一个大 `view.go`；不强制与其他层的文件一一对应。

多二进制项目优先按组件组织：

```text
{project}/
├── cmd/
│   ├── server/main.go
│   └── worker/main.go
└── internal/
    ├── server/                 # Server 的 composition root 与私有分层
    ├── worker/                 # Worker 的 composition root 与私有分层
    ├── event/                  # 两个组件共享的私有能力
    └── persistence/
```

## 分层边界

- `cmd/` 可以组装依赖和启动 controller / background loop，但业务判断下沉到所属 component。
- `api/` 负责协议适配和 view model 转换；Request、DTO、ORM PO 不直接穿透到 domain。
- `service/` 负责用例编排、事务边界和跨领域对象一致性，不重复实现 domain 已拥有的规则。
- `domain/` 可以采用充血模型，承载领域不变量、状态转换和不依赖外部 I/O 的业务行为。
- `model/` 约定为 PO，只表达数据库字段、关联和持久化形状，不承载领域行为。
- repo 的契约文件（常见为 `repo/<domain>.go`）输入输出使用 domain 对象或明确的领域查询条件；它不
  暴露 GORM、SQL、PO 或数据库方言。
- `repo/gorm/` 实现 repository 契约，负责查询拼装、PO 读写和 PO ↔ domain 转换，不承载业务决策。
- migration 文件和迁移执行资源放在 `migrations/`，不混入 `db/`。
- 配置来源由 composition root 统一收口；服务项目默认可从环境变量加载，并在使用时维护
  `.env.example`，但不要把环境变量写成所有 Go 项目的唯一配置方式。

## 验证

优先使用仓库已有的 `make fix`、`make lint`、`make test`、`make build` 等标准入口。没有统一入口时，
至少对受影响代码执行 `gofmt`，并运行对应 package 的 `go test`；涉及二进制组装或依赖变化时再运行
`go build`。验证范围与改动风险匹配，不因局部修改默认全量运行昂贵的集成测试。

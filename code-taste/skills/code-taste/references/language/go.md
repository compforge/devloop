# Go

## 工作区与依赖

- 先按项目的 module、workspace 与仓库约定定位源码，不假设固定的本机目录或代码托管域名。
- DB 访问默认使用 GORM。

## 项目布局

常见 Go service 结构如下：

```text
{project}/
├── cmd/
│   ├── {project}/main.go   # 程序入口
│   └── serve.go            # 子命令（Cobra），含服务初始化
├── migrations/             # SQL migration 文件与迁移执行资源
├── internal/               # 私有包，外部不可导入
│   ├── api/                # HTTP 层：路由、handler、请求/响应类型
│   ├── service/            # 业务编排层、事务、跨表一致性
│   ├── dao/                # 持久化查询与单表读写
│   ├── model/              # 数据模型（struct 定义）
│   ├── db/                 # 数据库连接与 DB runtime 工具
│   ├── config/             # 配置加载（从环境变量）
│   └── {其他集成}/          # 如 k8s/、cache/ 等外部系统集成
├── build/                  # Dockerfile
├── manifests/              # Helm Chart
├── Makefile                # 一般包含 make dev，便于快速部署到 dev
└── .env.example
```

## 分层边界

- `cmd/` 只做初始化和组装，不含业务逻辑。
- `internal/api/` 和 `cmd/serve.go` 的定时任务同属 controller 层，只负责触发，不参与业务
  细节；业务细节全部下沉到 service 层。
- `internal/service/` 负责核心业务编排、事务、状态流转和跨表一致性；复杂操作对外只暴露聚合
  方法，内部子步骤用小写方法封装。
- `internal/dao/` 负责单表 CRUD 和查询拼装，不承载业务决策。
- `internal/model/` 只放数据结构，不承载业务逻辑。
- migration 文件和迁移执行资源放在 `migrations/`，不混入 `internal/db/`。
- 配置统一从环境变量加载，`.env.example` 列出所有配置项。

## 验证

Go 代码改动后、提交前必须运行面向编译的检查：优先 `make build`；仓库没有该入口时运行
`go build` 或受影响 package 的 `go test`。

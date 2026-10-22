# Python

## 默认技术栈

- DB 访问默认使用 SQLAlchemy。
- 项目通常用一个继承 pydantic `BaseSettings` 的 settings 类集中外部依赖配置。
- Web 项目通常使用 FastAPI，并使用 dependency_injector 作为 IoC 框架。
- 日志以标准库 `logging` 作为接入面；服务端需要结构化上下文时推荐使用 `structlog` 并接入 `logging`。项目已有统一日志栈时沿用现有选择，不用 `print` 承担服务运行日志。
- 不要在 Python 包的 `__init__.py` 中加入 `__all__`；除非存在明确的公开 API 约束，否则不要为
  `from x import *` 增加额外维护面。

## 类型与接口

- 已有具体 class、`Protocol`、`TypedDict` 或 Pydantic model 时，在函数签名中标注对应类型，并直接
  使用它声明的属性和方法；不要退化成 `Any` 后用 `hasattr` / `getattr` / `setattr` 猜测接口。
- 不要为了兼容不真实的测试 mock 给生产代码增加反射分支。测试应构造真实 typed object，或实现明确的
  `Protocol`；让类型检查暴露接口不一致，而不是在运行时静默绕过。
- 只有输入本身确实是动态的（如外部反序列化数据、插件对象或反射框架）时才使用动态属性访问；应在
  边界处通过解析模型、`isinstance`、type guard 或 `Protocol` 尽早收窄类型，核心逻辑继续保持 typed。

## 项目布局

```text
backend/     # 项目真实代码，一些项目也叫 server
  /Makefile  # 一般包含 make lint / make fix，用于修复和验证静态规范
  /pyproject.toml
  /uv.lock   # 不要手工编辑；修改 pyproject.toml 后由 uv sync / uv lock 自动更新
manifests/   # Helm 部署文件
build/       # Docker 镜像构建文件
Makefile     # 一般包含 make dev，便于快速部署到 dev
```

## 测试与验证

- Python 代码改动后、提交前必须运行 `make fix` 和 `make lint`。
- 若测试目录已拆为 `tests/test_in_ci` 和 `tests/test_in_local`：
  - `test_in_ci` 放轻量、稳定、适合 CI 的测试；
  - `test_in_local` 放本地补充测试、较慢测试或依赖更多上下文的测试。
- `Makefile` 可能同时提供 `test`、`test-ci`、`test-local` 等入口。日常测试优先使用仓库已有的
  `make test` 或 `make test-local`，复用其 `PYTHONPATH`、环境变量和参数封装；只有需要单文件、
  单 case 或附加 pytest 参数时，才直接调用 `pytest` 或 `uv run pytest`。

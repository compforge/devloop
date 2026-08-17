# Python

## 默认技术栈

- DB 访问默认使用 SQLAlchemy。
- 项目通常用一个继承 pydantic `BaseSettings` 的 settings 类集中外部依赖配置。
- Web 项目通常使用 FastAPI，并使用 dependency_injector 作为 IoC 框架。
- 不要在 Python 包的 `__init__.py` 中加入 `__all__`；除非存在明确的公开 API 约束，否则不要为
  `from x import *` 增加额外维护面。

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

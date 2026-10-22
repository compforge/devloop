# TypeScript

## 默认技术选择

- Node.js 服务端结构化日志默认使用 `pino`；框架已提供日志抽象时使用它的 Pino adapter。浏览器端沿用项目的 telemetry/logger 抽象，不把服务端 logger 打包进前端；不用散落的 `console.log` 承担可观测性。
- 项目已有统一日志栈时沿用现有选择，不为局部改动引入第二套。

## 工作区组织

- `~/TSProjects` 存放 TypeScript 项目。
- 代码通常按 GitHub owner / repository 两级目录组织。

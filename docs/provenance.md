# 来源与本地改动

初版日期：2026-10-19。所有分发文件从代码、文档或自行编写内容整理，没有打包运行中的 descriptor、token、profile 配置值、浏览器资料或会话。

## Relay

- 上游：[tonytanglab/deepseek-harness-relay-mcp](https://github.com/tonytanglab/deepseek-harness-relay-mcp)。
- 基线：v0.2.17，原本地记录的基线 commit 为 `5f72f2d7d1ae519287af1087327add3f883d39ce`；本轮未联网重新核验 Git 标签。
- 使用的本地源码版本：`0.2.17-local.3`。上游 MIT 许可保留于 `vendor/harness-relay/LICENSE`。
- 已有本地适配包含 DSH 0.2.0-rc.2 / 0.2.1-alpha.2 peer 与 Windows 权限等调整；这不是上游原版，也不代表所有更新版 DSH 兼容。
- 本包另将 Windows ACL 调用的固定用户名路径改为 `DSH_RELAY_PWSH` 或 PATH 中的 `pwsh`；相应修改连接测试。对有固定执行规则的机器，应将该变量设为该机器已核验的 PowerShell 7 绝对路径。
- 随包 `dist/*.mjs` 由随包源码与根目录锁定依赖重新构建。`npm run verify:relay` 可比较重建结果；不包含原机器的 node_modules、junction、`.git` 或个人 MCP 配置。
- 根构建工具使用本地源码既有的 SDK 1.30.0、Zod 4.4.3 与 esbuild 0.25.12，并以根锁文件固定依赖。源快照的 npm 文件清单不再声明未随包提供的映射、类型或技能副本；根 `skills/` 是本包技能入口。
- `vendor/harness-relay` 保留上游开发脚本和测试供后续维护；根目录的构建和测试命令是本初版的验收入口，不宣称跑过全部上游测试或类型检查。

## 归档与技能

归档适配器由原精确 ID 归档流程整理：删除批量扫描路径，使用本机 descriptor 发现端口，YAML 解析依赖改为正常 npm 包，以 Host JSON 结果确认成功，不依赖输出空格。对外 MCP 仍只暴露 `archive_terminal_session`。

归档使用 DSH Web 的 browser-session grant 与 `workspace/archiveSession` 内部接口；该接口可能随 DSH 升级变化，维护者必须做目标版本实测。Host 活动拒绝不会被绕过，但 fresh 来源与调用时机属于 Agent 约束，不是 MCP 身份证明。

两个技能由本机已有的委派和会话隔离规则整理成通用版本，保留路径传递、授权和终态验收，不包含用户个人全局规则。Python 清单辅助器随委派技能附带，使用标准库校验包含关系及真实路径。

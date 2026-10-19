# DSH Codex Kit

让 Codex 通过本机 MCP 委派 DeepSeek Harness（DSH）任务，等待结果、验证交付，并归档本次新建的精确会话。

这是 **0.1.0 初版**：包含可运行代码、Relay 源码和技能，供 GitHub 发布及后续 DSH 接手。需要已有的本机 DSH；本包不包含模型账户、DSH 本体、凭据、浏览器资料或聊天记录。模型读取内容可能由所选提供商处理，loopback 仅代表本机控制链路。

## 包含什么

| 组件 | 路径 | 作用 |
| --- | --- | --- |
| Relay MCP | `scripts/relay-proxy.mjs` | 连接 DSH 内嵌 Relay，暴露能力查询、委派与监控 |
| 精确归档 MCP | `scripts/session-archive-mcp.mjs` | 接收一个完整 sessionId，返回结构化归档结果 |
| Relay 源码及构建 | `vendor/harness-relay/` | 上游 v0.2.17 的本地适配 `0.2.17-local.3`，保留 MIT 许可 |
| 委派技能 | `skills/delegate-to-deepseek-harness/` | 路径式派发、只读与实施权限、终态监控和验收 |
| 会话隔离技能 | `skills/dsh-session-hygiene/` | 每父任务一条新会话，终态消费后精确归档 |
| 配置生成 | `scripts/configure.mjs` | 生成这台电脑专用的 MCP JSON 与 Codex TOML 片段 |
| Codex 插件入口 | `.agents/plugins/marketplace.json` + `.codex-plugin/` | 让 `codex plugin marketplace add` 能安装本仓库并加载技能与两个 MCP |

## 快速开始

前置：Node.js **22.19 或更高**、npm、已有 DSH 与注册工作区。使用路径清单辅助脚本时另需 Python 3；不需要 Python 第三方库。

本地 Relay 适配声明的 DSH peer 为 **0.2.0-rc.2 或 0.2.1-alpha.2**。其他版本未核验，不能通过放宽 peer 版本范围宣称兼容。

在仓库根目录运行：

```sh
npm ci --ignore-scripts
npm test
npm run check
```

分发目录已经包含构建后的 Relay；修改 Relay 源码后运行：

```sh
npm run build:relay
npm run verify:relay
```

然后完成两侧接入：

1. 在 DSH 的 `web` profile 中安装并启用匹配版本的 Relay bundle。已有兼容 Relay 时不重复安装。操作说明见 [接入与验收](docs/setup.md)。
2. 运行 `npm run configure -- --home "这台电脑的 DSH_HOME 绝对路径"`，生成 `.local/mcp.json` 和 `.local/codex-mcp.toml`。将对应条目合并到客户端配置，保留已有其他 MCP。
3. 将 `skills/` 下两个技能目录交给客户端技能加载机制；或用 `codex plugin marketplace add <本仓库>` + `codex plugin add dsh-codex-kit@dsh-codex-kit` 以插件形式加载本目录（会一并带上技能与两个 MCP，注意该路线不注入 `DSH_HOME`）。手工安装只复制技能目录，不复制依赖、运行数据或整套个人全局规则。
4. 新开 Codex 任务或重载后，核验两个 MCP 均可见。使用原生 `doctor`、`list_workspaces` 和 `list_capabilities` 验收，禁止用临时终端客户端绕过缺失工具。

`codex mcp add`、`codex plugin marketplace add` 两条客户端命令已在 Codex CLI 0.147.0 的隔离 `CODEX_HOME` 中实测通过，见 [接入与验收](docs/setup.md)。配置生成器只写输出目录，不修改 Codex 配置、DSH profile、系统环境或已安装插件。若输出已存在会拒绝覆盖，可以换一个 `--out` 目录。路径移动后重新生成配置。个人配置留在 `.local/`，不要提交 Git。

## 如何使用

向 Codex 提出有明确范围的任务，例如：

```text
调用 DSH 完成：只读核对 docs/design.md 的第 6 节，给出精确行证据，不改文件。
```

```text
调用 DSH 修复 src/parser.ts 中已确认的输入校验问题，只允许修改该文件与 tests/parser.test.ts，并运行相关测试。
```

只读任务用 `start_review`；实施授权明确时用 `start_run` 加 `workspace-write`。只传工作区和路径，由 DSH 自行读取；不得把源码或 diff 粘进 Relay 参数。

生命周期为：

```text
筛选范围 → 查询工作区和能力 → fresh 创建运行 → wait_run 到终态
         → 消费 assistantText → 调用方验收 → 精确 sessionId 归档
```

安装技能本身**不会自动把所有任务切到 DSH**。若希望“轻量问答由 Codex 回答，文档核对等实际任务必须委派”，将 [可选路由规则](docs/routing-policy.md) 合并到 **Codex 侧**全局指令。不要写入 DSH 侧指令，避免 DSH 再次委派自身。

## 归档行为与边界

- 归档 MCP 不扫描会话目录、标题、年龄或数据库，只接受一个完整 `session-UUID`。
- 地址从本机 Relay descriptor 读取，没有固定端口；不跟随 HTTP 重定向，只连接 loopback。
- 为调用 DSH Web 归档接口，运行时会在本机读取 `.credentials.yaml` 中的 browser-session grant，并在内存中派生短期认证 Cookie。不会输出、存盘、打包或传给模型。**配置与 descriptor 都不要放入凭据值。**
- 返回 `archived: true` 才算确认成功。Host 拒绝、响应异常或超时记 `archive_pending`，不根据终端文字猜测。
- fresh 来源、终态答案已消费和用户是否要求保留由调用方核验；MCP 本身不能证明这些条件。Host 必须自行拒绝仍活跃的会话，本包不会绕过拒绝。
- 如需恢复，用户确认精确目标后可执行 `node scripts/session-archive.mjs unarchive --session <完整会话ID> --apply`。日常 Agent 归档仍使用原生 MCP，不以 CLI 代替。

## 已验证与待验证

制作机上（Windows，Node `v24.19.0`、pnpm `10.34.3`、DSH `0.2.1-alpha.2`、Codex CLI `0.147.0`）已用隔离 `DSH_HOME`/`CODEX_HOME` 实测：

- `dsh plugin --profile <name> add vendor/harness-relay` 以 `link:` 装入并自动登记到 `dsh.profile.bundles`，`--dump-config` 出现 relay 层；
- `scripts/relay-proxy.mjs` 连本机真实 descriptor，原生工具 22 个；`scripts/session-archive-mcp.mjs` 暴露 `archive_terminal_session`；
- `codex mcp add` 写入的配置与本包生成器一致；插件 marketplace 的安装、MCP 可见与卸载均可回退；
- 隔离 mock 覆盖 RPC、认证签名、拒绝响应、MCP stdio、路径与配置生成；Relay 从随包源码重建并比对一致。

以下仍需在目标机器验收：DSH 重启后 Host 重连、一次真实只读委派及其精确归档、插件清单在目标客户端（含桌面端）的安装、其他 DSH/Codex 版本。未宣称在所有系统或所有版本上已可用。

## 发布与接手

整个目录可作为独立 GitHub 仓库内容。仓库已公开：<https://github.com/ksoulness/dsh-codex-kit>，`main` 分支为首个提交，Release [v0.1.0](https://github.com/ksoulness/dsh-codex-kit/releases/tag/v0.1.0) 附带源码 ZIP 与 SHA-256 清单。后续更新、重新打包与推送核对见 [上传到 GitHub](docs/publishing.md)；上传前执行 `git status --short --ignored`，确认 `.local/`、`node_modules/`、凭据与运行数据未入库。模式扫描通过不代表绝对不存在所有敏感信息。

用本机 Python 3 执行 `scripts/package-release.py` 可生成源码 ZIP、逐文件 SHA-256 清单及 ZIP 哈希文件；输出位于仓库目录外，脚本拒绝覆盖已有同版本 ZIP。打包只包含明确列出的源码与文档，排除依赖和本地数据。

- [DSH 接手提示与验收清单](DSH-HANDOFF.md)
- [安装与故障定位](docs/setup.md)
- [上传到 GitHub](docs/publishing.md)
- [可选 Codex 默认路由](docs/routing-policy.md)
- [来源与改动](docs/provenance.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

本仓库无账户绑定与云端部署。`plugin.json`/`mcp.json` 提供通用插件清单，`.codex-plugin/`/`.mcp.json` 保留兼容入口；手工接入以配置生成器输出的绝对路径为准。插件入口依赖宿主传入 `DSH_HOME`，分发清单没有硬编码某台机器的数据根。

# DSH 接手初版

当前交付已公开发布：<https://github.com/ksoulness/dsh-codex-kit>（`main`，MIT），Release `v0.1.0` 附带源码 ZIP 与 SHA-256。**尚未安装到真实 Codex/DSH 环境**，Codex 不在本轮自动派发。

本文件下面的任务提示保留为接手入口；其中“运行 npm ci”“GitHub 仓库确认”等动作仍以接手时的实际授权为准。

## 本机已完成的可复现核验

制作机（Windows，Node `v24.19.0`、pnpm `10.34.3`、DSH `0.2.1-alpha.2`、Codex CLI `0.147.0`）：

- 隔离 `DSH_HOME`：`dsh plugin --profile <name> add vendor/harness-relay` 以 `link:` 装入，自动登记 `dsh.profile.bundles`，`--dump-config` 出现 relay 层。
- 真实 descriptor（只读）：`relay-proxy.mjs` 原生工具 22 个；`session-archive-mcp.mjs` 仅暴露 `archive_terminal_session`。
- 隔离 `CODEX_HOME`：`codex mcp add` 生成的配置与本包生成器一致；`codex plugin marketplace add` + `codex plugin add` 可加载两个 MCP，`remove` 可完全回退。
- 仓库侧：`npm test` 9/9、`npm run check`、`npm run verify:relay` 通过。

仍未做：真实 profile 安装与重启、Codex 实机加载、真实委派与归档、后续版本发布。

## 可直接交给 DSH 的任务提示

```text
请接手当前 dsh-codex-kit 初版，以 README.md、docs/setup.md、docs/provenance.md
和本文件为入口，先核验实际工作区和用户本轮授权。

目标：将本包完善为可在我指定 GitHub 仓库发布、并能在目标电脑复现安装的版本。
源码和初版实现已经存在，不要重做整套 Relay，也不要扩大到无关插件或技能。

先读取现有文件、根 package.json 和 package-lock.json，检查当前改动状态。
运行 npm ci --ignore-scripts、npm test、npm run check 和 npm run verify:relay。
检查两个 MCP 的原生工具加载；真实 DSH 安装、重启、归档或 GitHub 写入前，
确认用户本轮授权的目标机器、精确会话或目标仓库，不把本文件当作这些动作的授权。

重点验证：
1. DSH 目标版本的 bundle 安装命令、peer 与接口，不能只放宽 peer。
2. Codex 客户端对插件清单、cwd、PLUGIN_ROOT 与 DSH_HOME 的实际处理；
   手工配置生成器的绝对路径接入必须可用，保留已有 MCP。
3. 在授权后做一次指定文件的只读 fresh 委派，原生 wait_run 到终态，
   消费 assistantText 并复核证据，最后用原生归档 MCP 确认 archived:true。
4. Host 必须拒绝活动会话，失败保持 archive_pending；
   不能通过终端、直接数据库写入或强停绕过拒绝。
5. 检查发布树与许可，排除 .local、node_modules、实际凭据、profile、
   descriptor、token、原始会话及浏览器资料；扫描报告不得打印敏感值。

只在本仓库及用户明确授权范围修改，保留既有改动。不得覆盖其他全局规则、
读取无关凭据或发外部消息。没有明确 GitHub 仓库和发布授权时，
先完成本地可审阅内容，报告还缺的决定；不要擅自创建仓库、push 或 npm publish。
更新验证结果与真实限制，交付精确改动、测试结果和后续事项。
```

## 已知交接点

| 项 | 初版状态 | 后续验收 |
| --- | --- | --- |
| Relay 源码与构建 | 已整理并重新构建；隔离 profile 目录安装 + `--dump-config` 通过 | 目标 DSH 真实 profile 实装、重启与 Host 连接 |
| 归档核心与 stdio | 隔离 mock 验证；真实 descriptor 下 `archive_terminal_session` 可见 | 目标 Host 正常归档、活动拒绝与恢复 |
| 配置生成 | 隔离验证；`codex mcp add` 实测输出与生成器一致 | 目标客户端实际加载并完成原生工具验收 |
| Codex 插件入口 | `.agents/plugins/marketplace.json` 已加；隔离 `CODEX_HOME` 安装/卸载通过 | 目标客户端（含桌面端）安装，`DSH_HOME` 注入方式确认 |
| 技能 | 通用化并做结构校验；插件路线会随包加载 | 实际任务行为与授权边界 |
| 默认路由 | 提供 Codex 侧可选模板 | 用户决定是否合并及固定模型 |
| 许可与发布材料 | 保留上游许可及来源说明；`docs/publishing.md` 给出上传步骤 | 用户确认 GitHub 仓库名称、拥有者、可见性与认证方式 |
| 本地 Git 仓库 | 已推送 `ksoulness/dsh-codex-kit`（public，`main`）并发布 `v0.1.0` | 后续版本变更、Release 附件与 tags 维护 |

不要把“源码初版已完成”描述为“目标机器端到端验收已通过”。

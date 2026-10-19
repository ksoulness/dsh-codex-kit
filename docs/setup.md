# 在目标电脑接入

所有命令在仓库根目录执行。先确认目标 DSH 版本、profile 与工作区，不复制其他机器的运行数据和凭据。初版不提供自动改写现有 profile 的安装器。

## 0. 本机实测基线

本轮在制作机（Windows，Node `v24.19.0`、pnpm `10.34.3`、DSH `0.2.1-alpha.2`、Codex CLI `0.147.0`）用隔离的 `DSH_HOME` 与 `CODEX_HOME` 实测了第 1、2 节的命令；不触碰真实 profile、真实 Codex 配置和真实会话。

| 环节 | 实测结果 |
| --- | --- |
| `dsh plugin --profile <name> add <目录>` | 成功；pnpm 以 `link:` 安装，profile 的 `dsh.profile.bundles` 自动追加 `harness-relay-mcp` |
| `dsh --profile <name> --dump-config` | 输出包含 `- id: harness-relay-mcp` 层，无 error |
| `scripts/relay-proxy.mjs` 连真实 descriptor | `initialize` 返回 `dsh-relay-proxy`，`tools/list` 25 个原生工具 |
| `scripts/session-archive-mcp.mjs` | `archive_terminal_session`，参数仅 `sessionId` |
| `codex mcp add ... -- node ...` | 写入 `[mcp_servers.*]`，`codex mcp list` 显示两个 server |
| `codex plugin marketplace add` + `codex plugin add` | 两个 MCP 均按插件根解析相对路径并显示为 `enabled`；`remove` 可完全回退 |

未验证：真实只读委派、真实归档、DSH 重启后 Host 重连、其他 DSH 或 Codex 版本。详见 README“已验证与待验证”。

## 1. 准备 Relay bundle

已有与当前 DSH 兼容的内嵌 Relay 时跳到下一节。否则由目标机器的 DSH 把本包 `vendor/harness-relay` 作为 bundle 装入目标 profile：

```sh
dsh plugin --profile web add ./vendor/harness-relay
```

- 目录参数按当前工作目录解析，因此必须在仓库根执行；也可以传绝对路径。
- 该命令把参数原样转给 profile 目录下的 pnpm，需要目标机器有 pnpm。实测生成的依赖是 `harness-relay-mcp: link:<绝对路径>`，因此**移动或删除本仓库会让 DSH 的 Relay 层失效**，需要在移动后重新安装并重启。
- 安装成功后 `profiles/<profile>/package.json` 的 `dsh.profile.bundles` 会自动追加 `harness-relay-mcp`；不需要手改清单。

验证装入结果：

```sh
dsh --profile web --dump-config | grep -n harness-relay-mcp
```

Windows PowerShell 用 `Select-String harness-relay-mcp` 代替 `grep`。出现 `- id: harness-relay-mcp` 才说明 patch 层被读取；只看插件标题不算核验。

若 profile 里已有以 `file:` tarball 形式安装的同名包，先 `dsh plugin --profile web remove harness-relay-mcp` 再按上面安装，避免两个副本交替加载。二进制 `link:` 与 `file:` 互换成败取决于该机器 pnpm 行为，本轮未在真实 profile 验证，执行前记录原 `package.json`/`pnpm-lock.yaml` 以便回退。

不同 DSH 版本若不接受目录参数，由 DSH 按该版本的本地 bundle 安装契约接入，不能静默改为 npm 上另一版本或整块覆盖 profile。不要将 dump-config 全量输出发到聊天或 Git，其中可能包含配置值。

保留原有 profile 的其他插件与依赖。运行中的 DSH 需要何种重载/重启方式，以该机器的运行约定为准；本包不自动启动、重启或提权。

成功加载后，DSH 会在本机 `DSH_HOME/plugins/dsh-relay/<profile>/relay-endpoint.json` 发布连接元信息。文件含端点与本机路径，不应提交到 Git；不要读取或打印其中指向的 token 文件来排障。

## 2. 接入 Codex 侧 MCP

三条路线任选一条，不要同时启用同名 server。

### A. 配置生成器（默认推荐，含绝对路径）

```text
npm run configure -- --home <本机DSH_HOME绝对路径> --profile web
```

`--home` 必须是已存在目录。输出默认在 `.local/`，可用 `--out <新目录>` 更换；生成器不读取凭据。输出中使用当前 Node 可执行文件的绝对路径，避免桌面进程 PATH 与终端不同。

- 支持 `mcpServers` 的客户端：合并 `.local/mcp.json` 中两个 server。
- Codex TOML 配置：合并 `.local/codex-mcp.toml` 中两个 `mcp_servers` 表，先解决同名条目，不重复追加。

生成器只写输出目录，不修改 Codex 配置、DSH profile、系统环境或已安装插件；输出已存在时拒绝覆盖。

### B. `codex mcp add`（Codex CLI 实测可用）

```sh
codex mcp add harness-relay-mcp --env DSH_HOME=<本机DSH_HOME绝对路径> -- node <本仓库绝对路径>/scripts/relay-proxy.mjs
codex mcp add dsh-session-archive --env DSH_HOME=<本机DSH_HOME绝对路径> -- node <本仓库绝对路径>/scripts/session-archive-mcp.mjs
codex mcp list
```

实测写出的配置与本生成器一致：`command` 为 `node`，`args` 为脚本绝对路径，`env.DSH_HOME` 指向本机 DSH 根。`codex mcp add` 不写 `cwd`，两个脚本都不依赖当前目录。

### C. 作为 Codex 插件安装（本仓库根即 marketplace）

```sh
codex plugin marketplace add <本仓库绝对路径或 owner/repo>
codex plugin add dsh-codex-kit@dsh-codex-kit
codex mcp list
```

实测两个 server 均从插件根解析 `./scripts/*.mjs`，由客户端注入 `PLUGIN_ROOT`/`PLUGIN_DATA`，状态 `enabled`；`codex plugin remove` 后配置与缓存一并回退。

采用本路线前必须知道：

- 插件安装会把**整个仓库目录**复制到 `$CODEX_HOME/plugins/cache/...`。若已执行 `npm ci`，`node_modules/` 一并复制（本机约 29 MB）；若保留 `.local/`，其中的本机路径配置也会被复制。建议只复制发布源码，或安装前清理这两处。
- 插件路线不注入 `DSH_HOME`。要么在客户端进程环境中设置该变量，要么改用 A/B 路线显式传 `env.DSH_HOME`；缺失时脚本以 `DSH_HOME must be an absolute local path` 退出。
- 插件清单同时保留了根 `plugin.json`/`mcp.json`（通用 schema，`${PLUGIN_ROOT}` 由支持该约定的客户端展开）与 `.codex-plugin/`+`.mcp.json`（Codex 布局）。Codex 实际读取后者。
- 不同时启用插件入口和同名手工入口，避免两个 MCP 重复暴露。

不提交生成配置。它包含个人路径；MCP 认证由本机 Relay/归档器完成，配置无需任何 token、Cookie 或密码。

## 3. 加载技能

插件路线会在安装时带上 `skills/` 下两个技能。手工路线需通过客户端支持的技能/插件机制加载 `skills/delegate-to-deepseek-harness` 与 `skills/dsh-session-hygiene`；不要覆盖其他同名技能前直接整目录替换，先比较版本与当前引用。

需要默认委派策略时，再人工合并 [路由规则](routing-policy.md) 到 Codex 侧指令。只安装技能不表示规则已经写入全局，也不改变当前用户的授权。

## 4. 原生工具验收

新开客户端任务或按客户端支持方式重载，然后：

1. 两个 MCP 均完成 initialize，归档 MCP 的目录中有 `archive_terminal_session`。
2. Relay 原生 `doctor` 显示连接可用；核验实际 `relayVersion`，不只看插件标题。
3. 原生 `list_workspaces` 返回目标工作区，`list_capabilities` 返回要用的精确模型与权限。
4. 明确授权一次只读任务，`sessionMode: fresh`，范围只指向指定文档；观察 `promptAdmission: accepted`、`sessionReused: false`。
5. 持续原生 `wait_run` 到终态，消费 `assistantText`，复核文件证据。
6. 确认该完整 sessionId 为本次创建、没有活动运行且不需保留，调用归档 MCP，读回 `archived: true`。

以上涉及真实机器状态，交由后续维护者在取得相应授权后执行。本轮隔离测试与 MCP 握手不能替代它们。

## 故障定位

| 现象 | 核对项 | 处理 |
| --- | --- | --- |
| 找不到 DSH_HOME | 两个 server 的 env 与本机路径 | 重新生成配置；不从另一机器复制 |
| `DSH_HOME must be an absolute local path` | 客户端是否传了该变量（插件路线默认不传） | 在插件/CLI 配置中补 `env.DSH_HOME` |
| `dsh plugin add` 报 pnpm 缺失 | 目标机器是否装 pnpm | 先装 pnpm，或改用该版本的本地 bundle 安装契约 |
| `--dump-config` 无 relay 层 | bundle 是否装入目标 profile、路径是否被移动 | 重装 `vendor/harness-relay` 后重启；不要只改 package.json |
| `codex plugin marketplace add` 报无受支持清单 | 仓库根是否含 `.agents/plugins/marketplace.json` | 使用本仓库或补齐清单，不要改成无清单目录 |
| 工具目录缺失 | 插件/配置是否重载；是否有重复 server | 修正配置并新开任务，不用临时 RPC 脚本绕过 |
| Relay 无路由 | DSH 是否运行、bundle 是否加载、profile 是否相同 | 使用原生 doctor；不手工复制 token |
| 模型不可用 | list_capabilities 的实际路由 | 如实报告或取得更换模型的决定 |
| 归档失败 | descriptor 是否属于该机器，grant 格式与 Host 接口是否匹配 | 保留会话并记 `archive_pending`；不输出认证内容 |
| 活动会话被拒绝 | 是否仍在运行、是否已消费终态 | 等真正终态；不强停或改数据库 |
| DSH 升级后失效 | peer 与内部接口是否变化 | 先核验源码和契约，再修改适配；不只放宽版本号 |

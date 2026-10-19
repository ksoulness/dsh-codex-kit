# 在另一台电脑安装

同一份仓库可以在多台电脑上用，但**每台机器各自安装、各自生成配置**：仓库共用，路径、凭据、会话都不共用。下面以「新机器 B」为例，旧机器 A 的一切运行数据都不参与。

## 0. 先确认 B 具备什么

| 条件 | 说明 |
| --- | --- |
| B 上已装并运行 **DSH** | bundle 的 peer 为 `0.2.0-rc.2` 或 `0.2.1-alpha.2`；版本不符时先核验接口，不要只放宽版本号 |
| B 上**有人登录过** DSH Web | 归档要用本机的 browser-session grant（`.credentials.yaml`）；没登录过就只能委派、不能归档 |
| Node.js ≥ 22.19、pnpm、git | pnpm 用于把 Relay bundle 装进 DSH profile |
| 一个 MCP 客户端 | Codex CLI（推荐，`codex mcp add` / `codex plugin`）或任何支持 stdio MCP 的客户端 |
| 可选 Python 3 | 打包与路径清单脚本用 |

不需要：A 的 `node_modules/`、`.local/`、descriptor、令牌、会话、profile 配置。

## 1. 安装（任选一条）

### A. 交给 B 上的 AI 执行

```text
帮我在本机安装 dsh-codex-kit，并做一次只读验收。
仓库：https://github.com/ksoulness/dsh-codex-kit

1. 先读 README.md 与 docs/setup.md；自己探测本机 DSH 版本、DSH_HOME 绝对路径、profile 名，
   不要照抄任何示例里的路径。
2. git clone 到一个固定目录，执行 npm ci --ignore-scripts、npm test、npm run check、
   npm run verify:relay；失败就停下报告。
3. 备份该 profile 的 package.json 与 pnpm-lock.yaml，再执行
   dsh plugin --profile <profile> add ./vendor/harness-relay，
   用 dsh --profile <profile> --dump-config 确认出现 harness-relay-mcp 层。
4. 用 npm run configure -- --home <DSH_HOME> --profile <profile> 生成配置并合并到客户端，
   或直接用 codex mcp add（env 里 DSH_HOME 必须写本机绝对路径，profile 非 web 时再加 DSH_PROFILE）。
   然后用 codex mcp list 确认两个 server 都是 enabled。
5. 新开客户端任务，调用原生 doctor、list_workspaces、list_capabilities 各一次，把真实返回值贴给我。

不要做的事：不要从其他电脑复制 .local/、descriptor、令牌或会话；不要 push；
不要归档任何会话；不要读取或打印凭据；不要用危险权限覆盖现有 profile。
```

### B. 手工五步

```sh
git clone https://github.com/ksoulness/dsh-codex-kit
cd dsh-codex-kit
npm ci --ignore-scripts && npm test          # 9/9

# 1) Relay 装进本机 DSH 的目标 profile（已有兼容 Relay 可跳过）
dsh plugin --profile web add ./vendor/harness-relay
dsh --profile web --dump-config | grep harness-relay-mcp

# 2) 用本机 DSH_HOME 生成客户端配置（输出在 .local/，不改现有配置）
npm run configure -- --home <本机 DSH_HOME 绝对路径> --profile web

# 3) 合并 .local/mcp.json（或 .local/codex-mcp.toml）到客户端；或直接：
codex mcp add harness-relay-mcp --env DSH_HOME=<本机 DSH_HOME> -- node <本仓库绝对路径>/scripts/relay-proxy.mjs
codex mcp add dsh-session-archive --env DSH_HOME=<本机 DSH_HOME> -- node <本仓库绝对路径>/scripts/session-archive-mcp.mjs
codex mcp list

# 4) 重载 / 新开客户端任务
# 5) 原生工具验收（见第 3 节）
```

profile 不是 `web` 时，环境变量要加 `DSH_PROFILE=<profile>`；不加时脚本默认读 `web`，会找不到别的 profile 的 descriptor。

### C. 只装成 Codex 插件

```sh
codex plugin marketplace add ksoulness/dsh-codex-kit
codex plugin add dsh-codex-kit@dsh-codex-kit
codex mcp list
```

插件路线会把技能一起装上，但**不注入 `DSH_HOME`**：要在客户端环境里设置，否则两个 MCP 会以 `DSH_HOME must be an absolute local path` 退出。

## 2. 绝不能从旧机器复制的东西

| 对象 | 为什么 |
| --- | --- |
| `DSH_HOME/plugins/dsh-relay/<profile>/relay-endpoint.json` | 含本机端口与路径，换机即失效 |
| `DSH_HOME/.credentials.yaml`、任何 token 文件 | 与设备/机器绑定，复制不等于授权 |
| `.local/` | 里面是上一台机器的绝对路径 |
| `node_modules/` | 平台相关的二进制（esbuild 等）可能不兼容，`npm ci` 重装即可 |
| 会话、`webUrl`、归档记录 | 属于上一台机器的 DSH，不可跨机操作 |
| 客户端的 `config.toml` / `mcp.json` | 路径与 env 都是那台机器的 |

## 3. 验收（B 上必须自己做）

1. 两个 MCP 出现在客户端，归档 MCP 有 `archive_terminal_session`；
2. 原生 `doctor` 连接正常，`list_workspaces` 返回 B 的工作区，`list_capabilities` 返回 B 的真实模型；
3. 一次**已授权**的只读 `start_review`，`sessionMode: fresh`，观察 `promptAdmission: accepted`、`sessionReused: false`；
4. `wait_run` 到终态，读 `assistantText` 并自己核对文件证据；
5. 确认该 `sessionId` 是本次新建、已消费终态、无需保留后归档，读回 `archived: true`。

第 3–5 步产生真实机器状态，必须在 B 上按当次授权执行；隔离测试不能替代。

## 4. 升级、卸载与回滚

```sh
# 升级代码（MCP 是 stdio 脚本，改完只需重启客户端）
git pull && npm ci --ignore-scripts && npm test

# 改了 relay 源码才需要重建并核对
npm run build:relay && npm run verify:relay

# 卸载
dsh plugin --profile web remove harness-relay-mcp
codex mcp remove harness-relay-mcp
codex mcp remove dsh-session-archive
# 插件路线：codex plugin remove dsh-codex-kit@dsh-codex-kit && codex plugin marketplace remove dsh-codex-kit
```

装/卸 bundle 前先备份该 profile 的 `package.json` 与 `pnpm-lock.yaml`；DSH 升级后若要回退，恢复这两份文件再重启。

## 5. 平台差异

- **Windows**：生成器写入当前 Node 的绝对路径（桌面进程 PATH 与终端不同）；Relay 的 ACL 调用使用 `DSH_RELAY_PWSH` 或 PATH 中的 `pwsh`（PowerShell 7），有固定执行规则的机器应把该变量指向已核验的绝对路径。
- **macOS / Linux**：命令等价，但本包只在 Windows 上实测过（Node 24.19 / pnpm 10.34 / DSH 0.2.1-alpha.2 / Codex CLI 0.147.0）；`DSH_HOME` 必须是绝对路径，`~` 不会被展开。**未验证**，请按第 3 节自行验收。

## 6. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `DSH_HOME must be an absolute local path` | 客户端没传 env（插件路线默认不传） | 在配置里补 `env.DSH_HOME` |
| 找不到 descriptor / 工具报无路由 | DSH 没运行、bundle 没装进该 profile，或 `DSH_PROFILE` 与实际不符 | 先 `dsh --profile <p> --dump-config` 确认，再 `doctor` |
| 归档 401/403 | 该机器的 grant 缺失或过期 | 在这台机器的浏览器重新登录 DSH Web 后重试；不要复制别的机器的凭据 |
| 归档 `archive_pending` | 会话仍活跃或 Host 拒绝 | 等真正终态；不强停、不改数据库 |
| 客户端看不到工具 | 未重载，或同名 server 重复 | 新开任务；同时只保留一条入口 |

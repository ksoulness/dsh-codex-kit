# DSH Codex Kit

[![Release](https://img.shields.io/github/v/release/ksoulness/dsh-codex-kit?display_name=tag)](https://github.com/ksoulness/dsh-codex-kit/releases) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D22.19-brightgreen.svg)](https://nodejs.org) [![MCP](https://img.shields.io/badge/MCP-stdio-8A2BE2.svg)](https://modelcontextprotocol.io)

> **Codex 负责跟你对话，本机的 DeepSeek Harness（DSH）负责真正干活：一次派发、等到终态、验收结果、按精确 ID 归档——源码不离开工作区。**

一个本机 MCP 工具包，把「Codex 想清楚」和「DSH 动手做」接成一条闭环：Codex 用原生工具把有明确范围的任务派给 DSH，持续监控到终态，读完 `assistantText` 自己复核证据，最后只归档这次新建的那个会话。

不复制粘贴代码，不搬运 diff，不靠终端里手敲 RPC。

## 解决什么问题

| 没有它的时候 | 有了它 |
| --- | --- |
| 想让别的模型干活，只能把整段源码、diff、仓库压缩包粘进聊天框：上下文爆炸、内容外流、改完还对不上 | 只传**工作区 + 路径 + 范围 + 授权 + 验收**，由 DSH 在本机自己读；源码不出工作区 |
| 派出去的任务没法盯：跑没跑、跑完没有、卡在哪，全靠猜 | `wait_run` 拉到终态，`state`/`stopReason`/`assistantText` 都是结构化字段，超时不算终态 |
| 「它说做完了」= 验收？ | 工具返回的是**证据**：实际改动路径、测试结果、限制说明；调用方自己复核文件差异才算完 |
| 会话台账越堆越乱：分不清哪条是这次任务、哪条能动、哪条是用户的 | 每个父任务一条 `fresh` 会话，记录 `sessionId`/`sessionReused:false`，终态消费后按完整 ID 归档，`archived:true` 才算成功 |
| 路径/权限靠口头约定 | `reviewTargets`、`contextReadScope`、`excludedPaths`、`writeScope` 显式声明；只读任务权限固定 `read-only`，实施才用 `workspace-write` |

## 最后效果

一次「只读核对 + 精确归档」在 Codex 里长这样（工具名、字段名都是真实接口；真机端到端验收见下方「已验证 / 未验证」）：

```text
你   ❯ 调用 DSH 只读核对 docs/design.md 第 6 节，给出精确行证据，不改文件

Codex ❯ list_workspaces                    → 选中已注册工作区
        list_capabilities                  → provider/model/effort/权限的真实取值
        start_review {                     → promptAdmission: accepted
          workspace, reviewTargets:["docs/design.md"], contextReadScope:[...],
          sessionMode:"fresh", openBrowser:false, provider, model,
          authorizationBasis:"explicit-user-request", idempotencyKey }
                                           → runId, sessionId, sessionReused:false, webUrl
        wait_run { runId }                 → 未终态就继续等；hostMustCallWaitRunAgain:true
        wait_run { runId }                 → state:"succeeded", stopReason:"end_turn"
        （读 assistantText → 自己打开文件核对行号与结论）

        archive_terminal_session {         → { archived: true }
          sessionId: "session-<完整 UUID>" }
```

你拿到的不是「已完成」四个字，而是：结论 + 文件行证据 + 实际改动 + 验证结果 + `archived: true`。任何一步没坐实（比如 Host 拒绝归档），它会如实留 `archive_pending`，不会编一个成功。

## 提示词怎么写

关键是**说清范围与授权**，而不是把内容塞给它。三条可直接复制的模板：

**1. 只读核对 / 评审 / 调研**（不改文件，走 `start_review`）

```text
调用 DSH 只读核对 <文件或目录> 的 <章节/问题>：给出精确文件与行证据、影响面、
最小修复建议和置信度；无法验证的标为未验证。不要修改任何文件。
```

**2. 明确授权的实施**（改代码，走 `start_run` + `workspace-write`）

```text
调用 DSH 修复 <文件> 中已确认的 <问题>。只允许修改 <文件A> 与 <测试文件B>，
运行相关测试并回报结果；不要提交、不要 push、不要碰其他文件。
```

**3. 长任务 / 多轮**（同一会话续接，不新开）

```text
调用 DSH 继续 <上次的 runId 或会话>：把 <新增要求> 补进去，
仍然只改 <范围>，完成后给出改动路径与测试结果。
```

反例（会破坏这套设计）：

- ❌ 把源码 / diff / zip 贴进任务内容 —— 应该只给路径，让 DSH 自己读。
- ❌ 「随便看看 / 你懂的」—— 没有范围就没有可验收的证据。
- ❌ 派发后立刻宣布完成 —— 必须 `wait_run` 到终态并消费 `assistantText`。
- ❌ 用临时 Node / PowerShell 脚本自己打 JSON-RPC —— 原生工具缺失就修安装，不要绕过。

想让 Codex **默认**把实际任务都派出去（轻问答仍自己答），把 [可选路由规则](docs/routing-policy.md) 合并到 Codex 侧全局指令即可。

## 安装

前置：本机已有可用的 **DSH**（bundle peer 为 `0.2.0-rc.2` 或 `0.2.1-alpha.2`）、**Node.js ≥ 22.19**、**pnpm**（装 DSH bundle 用）。可选：Python 3（打包与路径清单脚本）。

### A. 丢给 AI（推荐）

把下面整段发给 Codex / Claude Code / 任意能执行命令的 Agent，它会自己装完并验收：

```text
帮我在本机安装 dsh-codex-kit，并做一次只读验收。

仓库：https://github.com/ksoulness/dsh-codex-kit

步骤：
1. 先读 README.md、docs/setup.md、docs/publishing.md，确认本机 DSH 版本与 DSH_HOME 绝对路径。
2. git clone 到本机一个固定目录；在该目录执行 npm ci --ignore-scripts、npm test、
   npm run check、npm run verify:relay。任何一步失败就停下报告，不要跳过。
3. 先备份目标 profile 的 package.json 与 pnpm-lock.yaml，
   再执行 dsh plugin --profile <profile> add ./vendor/harness-relay；
   用 dsh --profile <profile> --dump-config 确认出现 harness-relay-mcp 层。
4. 用 codex mcp add 接入两个 MCP（env 必须带 DSH_HOME 绝对路径），
   或用 npm run configure 生成配置后合并；然后用 codex mcp list 确认两个 server 都是 enabled。
5. 新开一个 Codex 任务，调用原生的 doctor、list_workspaces、list_capabilities 各一次，
   把真实返回值贴给我。

不要做的事：不要 push、不要改远端、不要提交代码、不要归档任何会话、
不要读取或打印任何 token / cookie / 密钥、不要用危险权限覆盖我的 profile。
每一步的实际输出都要贴出来；不确定的地方问我，不要猜。
```

### B. 手动三步

```sh
# 1) 拿到源码
git clone https://github.com/ksoulness/dsh-codex-kit && cd dsh-codex-kit
npm ci --ignore-scripts && npm test        # 9/9

# 2) 把 Relay 装进 DSH 的目标 profile（已有兼容 Relay 可跳过）
dsh plugin --profile web add ./vendor/harness-relay
dsh --profile web --dump-config | grep -n harness-relay-mcp

# 3) 接入 Codex 的两个 MCP（把 <...> 换成你的真实路径）
codex mcp add harness-relay-mcp --env DSH_HOME=<本机 DSH_HOME 绝对路径> \
  -- node <本仓库绝对路径>/scripts/relay-proxy.mjs
codex mcp add dsh-session-archive --env DSH_HOME=<本机 DSH_HOME 绝对路径> \
  -- node <本仓库绝对路径>/scripts/session-archive-mcp.mjs
codex mcp list
```

`npm run configure -- --home <DSH_HOME> --profile web` 可以生成同样内容的 `.local/mcp.json` 与 `.local/codex-mcp.toml`（含绝对路径，供手工合并），不修改你的任何现有配置。

### C. 只要插件（一条命令）

```sh
codex plugin marketplace add ksoulness/dsh-codex-kit
codex plugin add dsh-codex-kit@dsh-codex-kit
```

插件路线会一并带上两个技能，但**不注入 `DSH_HOME`**，需要你在客户端环境里设置，或改用 A/B。细节与三条路线的差异见 [安装与故障定位](docs/setup.md)。

**换一台电脑？** 同一份仓库多机并用时，每台机器各自安装、各自生成配置，`descriptor`/凭据/`.local/` 一律不跨机复制：见 [在另一台电脑安装](docs/other-machines.md)。

## 工具清单

Relay 暴露 **25** 个原生 MCP 工具（`scripts/relay-proxy.mjs` 转发到 DSH 内嵌 Relay），归档 MCP 只暴露 1 个：

| 工具 | 作用 |
| --- | --- |
| `doctor` / `setup_doctor` / `setup_plan` | 连接与安装自检 |
| `list_workspaces` / `list_workspace_sessions` | 找到已注册工作区与历史会话 |
| `list_capabilities` | 真实可用的 provider / model / effort / 权限 |
| `start_review` | 只读派发（权限固定 `read-only`） |
| `start_run` | 实施派发（`permissionPreset: workspace-write`） |
| `wait_run` / `get_run` / `get_run_summary` / `status_run` / `list_runs` | 监控到终态 |
| `steer_run` / `reply_run` / `cancel_run` | 运行中纠偏、终态后补充、取消 |
| `read_notifications` / `open_run` | 事件与页面链接 |
| `get_operation` / `reconcile_operation` / `reconcile_permissions` | 不确定是否送达时的核对 |
| `start_service` / `open_service` / `list_services` / `stop_service` | Host 服务管理 |
| `archive_terminal_session`（归档 MCP） | 按完整 `sessionId` 归档，返回结构化结果 |

## 它怎么跑起来

```text
┌────────────┐   stdio MCP    ┌──────────────────────┐   loopback HTTP   ┌───────────────┐
│  Codex     │ ─────────────▶ │ relay-proxy.mjs      │ ────────────────▶ │ DSH 内嵌 Relay │
│ (客户端)    │ ◀───────────── │ (25 个原生工具)      │ ◀──────────────── │ (vendor bundle)│
└────────────┘                └──────────────────────┘                   └───────┬───────┘
      │                                                                          │ 真实会话
      │  stdio MCP          ┌──────────────────────┐   descriptor + grant          ▼
      └────────────────────▶│ session-archive-mcp  │ ────────────────▶  DSH Web /archiveSession
                            └──────────────────────┘                   （拒绝活动会话）
```

- 端口从本机 `DSH_HOME/plugins/dsh-relay/<profile>/relay-endpoint.json` 读取，没有硬编码端口，也不跟随重定向。
- 归档只接受一个完整 `session-<UUID>`；不扫目录、不按标题/天数批量处理。
- 两个 MCP 都是 stdio，不需要开公网、不需要云端账号、不发任何外部消息。

## 安全与边界

- **路径声明不等于沙箱**：`reviewTargets` 等字段是给模型的指令声明；模型可能把它读到范围内的内容发给所选提供商。loopback 只描述控制链路。
- **归档不绕过拒绝**：会话仍活跃或 Host 拒绝时保留 `archive_pending`，不通过终端、数据库直写或强停绕过。
- **凭据只在内存**：归档适配器在本机读取 browser-session grant 派生短期 Cookie，不落盘、不打包、不传给模型。
- **不自动改你的环境**：配置生成器只写输出目录；安装器不覆盖已有 profile，也不需要凭据值写进配置。
- 本包不是 DeepSeek / OpenAI 官方产品，模型读取内容由所选提供商按其条款处理。

## 已验证 / 未验证

在制作机（Windows、Node `v24.19.0`、pnpm `10.34.3`、DSH `0.2.1-alpha.2`、Codex CLI `0.147.0`）用隔离 `DSH_HOME` / `CODEX_HOME` 实测：

- ✅ `dsh plugin --profile <name> add ./vendor/harness-relay` → `link:` 装入，`dsh.profile.bundles` 自动登记，`--dump-config` 出现 relay 层；
- ✅ 真实 descriptor 下 `relay-proxy.mjs` 列出 25 个原生工具；`session-archive-mcp.mjs` 只暴露 `archive_terminal_session`；
- ✅ `codex mcp add` 写出的配置与包内生成器一致；`codex plugin marketplace add` + `plugin add` 可装可卸；
- ✅ 隔离 mock 覆盖 RPC、认证签名、拒绝响应、MCP stdio、路径与配置生成；`npm test` 9/9；Relay 重建与源码一致。

尚未验证（请在自己的机器上验收）：DSH 重启后的 Host 重连、一次**真实**只读委派及其精确归档、Codex 桌面端加载、其他 DSH / Codex 版本。

## 目录结构

```text
scripts/relay-proxy.mjs            Codex → DSH 的 stdio MCP 代理（25 工具）
scripts/session-archive-mcp.mjs    精确会话归档 MCP（1 工具）
scripts/configure.mjs              按本机路径生成 MCP / Codex 配置
vendor/harness-relay/              Relay 源码与构建产物（上游 MIT，本地适配 0.2.17-local.3）
skills/delegate-to-deepseek-harness/   派发、监控、验收流程
skills/dsh-session-hygiene/            每任务一新会话、终态后精确归档
.agents/plugins/marketplace.json   Codex 插件市场入口
tests/  docs/  licenses/           隔离测试、文档、第三方许可
```

## 文档

- [安装与故障定位](docs/setup.md) —— 三条接入路线的实测命令、故障表
- [在另一台电脑安装](docs/other-machines.md) —— 多机并用、不能复制的东西、跨平台差异
- [上传到 GitHub](docs/publishing.md) —— 版本发布、Release 附件、回退
- [可选 Codex 默认路由](docs/routing-policy.md)
- [来源与本地改动](docs/provenance.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)
- [DSH 接手提示与验收清单](DSH-HANDOFF.md)

## 来源与许可

本仓库新增代码与文档为 MIT。`vendor/harness-relay` 来自 [tonytanglab/deepseek-harness-relay-mcp](https://github.com/tonytanglab/deepseek-harness-relay-mcp) v0.2.17 的本地适配（MIT，许可见 `vendor/harness-relay/LICENSE`）；构建内嵌依赖的许可列在 [`licenses/`](licenses/) 与本文件同级的 `THIRD_PARTY_NOTICES.md`。DSH、Codex、模型服务不在本包内，各按其自身许可与条款。

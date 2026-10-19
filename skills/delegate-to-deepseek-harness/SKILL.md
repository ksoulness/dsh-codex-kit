---
name: delegate-to-deepseek-harness
description: "通过已安装的 DSH Relay MCP 委派有明确范围的分析、文档核对或工作区实施任务，监控到终态并验证结果。用户点名 DSH 或已启用相应任务路由规则时使用。"
---

# 委派 DSH

使用宿主提供的原生 Relay MCP 工具。MCP 名称前缀因客户端而异，以实际工具目录为准；不得用终端、临时 HTTP/RPC 客户端替代缺失的 MCP 工具。

## 范围与权限

- 核对当前工作区及适用的项目规则（例如 `AGENTS.md`、`PROJECT.md`）；读取最近的实际规则，不猜测入口是否存在。
- 用户要求调用 DSH 审阅明确工作区，即授权该 DSH 模型处理范围内读取；不要求重复披露确认。该授权不覆盖凭据、其他项目或外部写入。
- 分析、研究、规划、代码审查、文档核对使用 `start_review`，原生权限固定为只读；仅当用户授权实施时，使用 `start_run` 加 `permissionPreset: workspace-write`。
- 不因调用 DSH 自动取得写入授权。不为检索升级到 `danger-full-access`。能力或权限不足时，将动作、目标、理由、风险与最小权限替代方案交给调用方处理。
- 将审阅对象放入 `reviewTargets`，必要的实现、测试或规则证据放入 `contextReadScope`。仅在用户要求仅审目标文件时才把两者设为相同。
- `excludedPaths` 明确排除凭据、`.env`、浏览器存储、原始会话、生产数据和无关路径；`writeScope` 限定授权写入位置，只读时为空。
- 这些路径字段是指令声明，不是逐路径文件系统隔离；模型可能向其配置的提供商发送范围内读取内容。Relay 的 loopback 地址只描述控制通道。

## 派发

1. 调用 `list_workspaces`，按实际路径选择已注册工作区；不能仅凭 Host 的 cwd 判断工作区不存在。
2. 调用 `list_capabilities`，按用户选择或部署方约定选取实际存在的 provider、model、effort 和权限，不猜模型标识，不静默换提供商。未约定模型时，使用能力目录返回的默认路由；模型不可用就报告。
3. 用 [scripts/build_task_manifest.py](scripts/build_task_manifest.py) 构造路径清单。它只核验路径，不读取源文件内容。Python 3 路径按当前机器确定；不要照抄其他机器的路径。
4. 对本父任务第一次调用 `start_review` 或 `start_run`，显式 `sessionMode: fresh`、`openBrowser: false`，使用稳定 `idempotencyKey`。用户明确选择 Harness 时，`start_review` 必须带精确 provider、model 和 `authorizationBasis: explicit-user-request`。没有显式授权证据时，不伪造此标记；按原生接口要求取得所需输入。
5. 只传工作区、路径、范围、排除项、授权与验收；不得把源码、文件正文、diff、编码源码或仓库压缩包放入 task/content。由 DSH 自行读取授权位置。

任务提示必须声明：适用项目规则、保留已有改动、精确读写范围、无提交/push/外部消息/凭据访问/破坏性清理/直接修改 `.git` 的额外授权。允许按任务需要查公开一手资料，要求重大外部事实附 URL；不授权登录、私有服务、上传或外部写入。

只读提示要求不修改文件，结论附精确文件和行证据、影响、最小建议和置信度，无法验证项标为未验证。实施提示要求实际完成授权修改、适当验证并返回改动路径、结果和限制。

## 监控与收尾

- 检查 `promptAdmission`、实际模型、权限、runId、sessionId 与 `sessionReused: false`；保存它们与工作区、webUrl、状态。分享链接不等于任务完成，不自动打开浏览器。
- 持续调用 `wait_run` 直到终态。超时只是一个等待片段；`hostMustCallWaitRunAgain: true` 时继续等待，不能交付最终结果。
- 不确定是否提交成功时，使用原 run 或 operation 核对，最多用同一幂等键重试一次，不生成新键重复派发。
- 活动任务的纠正先用 `steer_run`；真正终态后的补充用 `reply_run`。同父任务不另建会话。不要为了补充方向随意取消任务。
- 读取终态 `assistantText`；缺失答案、错误或需关注状态不能当作成功。
- 调用方复核重大只读结论；实施任务对照实际文件差异，确认范围及已有用户改动，再运行与改动风险相称的验证。DSH 的总结不能代替验收。
- 使用同包 [会话隔离技能](../dsh-session-hygiene/SKILL.md) 收尾；只归档本次 fresh 创建、已消费终态、没有活动运行且用户未要求保留的精确 sessionId。读取 `archived: true` 后才报告已归档，否则记 `archive_pending`。
- 原生工具不可用或自动审批拒绝时保留现状，说明具体动作、范围、原因和是否已创建 run；不换传输绕过。

交付包含结果、验证、未验证限制、实际改动及会话归档状态。运行仍在进行时不宣布完成。

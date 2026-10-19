---
name: dsh-session-hygiene
description: "在 DSH Relay 委派中保持每个父任务独立会话，续接同一运行，并在消费终态结果后按精确 ID 归档。与 DSH 委派流程配合使用。"
---

# DSH 会话隔离与归档

- 每个父任务第一次调度必须 `sessionMode: fresh`。不得使用 `latest-idle`、任意已有 sessionId，或为了派发读取用户已有会话列表。
- 记录首次返回的工作区、runId、完整 sessionId、sessionReused、webUrl 与状态。同任务的后续步骤只用已有运行的 `reply_run`；每次记录新 runId 与继承的 sessionId。
- 活动运行用 `steer_run` 纠正，终态后才能 `reply_run`。传输超时不等于终态，不得因此另建会话重复执行。
- 只有本任务 fresh 创建、来源明确、终态答案已消费、没有活动运行，且用户未要求保留时，才能调用原生归档 MCP `archive_terminal_session`。
- 只传 Relay 返回的完整 `session-UUID`；不得按标题、前缀、天数扫描或批量归档，不处理未知来源、复用或用户手动创建的会话。
- Host 活动拒绝时保留会话，记录 `archive_pending`；不得强停或直接改数据库绕过拒绝。
- `archived: true` 才是归档成功。状态矛盾、错误、超时或工具不存在都保留为未确认，不凭终端文字猜测成功，不用其他客户端绕过。
- 本包归档 MCP 的完整 ID 校验与 Host 响应校验是代码约束；fresh 来源、消费终态和归档时机由调用方核验，不能声称 MCP 独立证明了这些条件。

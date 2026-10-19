# 可选：Codex 默认委派规则

将下面文本合并到目标电脑 **Codex 侧**全局指令。它是可选部署策略，技能安装不会自动生效；不要写入 DSH 的全局指令。先确认两个 MCP 与技能可用，再启用。

```text
每次由 Codex 先做范围筛选。问候、简单解释等不涉及实际执行的轻量问答，
由 Codex 直接回答，不调用 DSH Relay、list_capabilities，也不创建 DSH 会话。
仅提及 DSH、模型或天气不是派发理由。若需要实际查询或取得外部证据，按执行任务处理。

分析、检索、代码或文档修改、命令执行、测试、排障、数据处理、项目操作与文档核对，
按已授权范围交给 DSH。不得因“只读”“不改文件”把实际任务降级为轻量问答。
Codex 保留范围筛选、项目与授权核验、技能加载、必要的派发前置、原生 MCP 操作、
运行监控、交付复核和平台明确要求由 Codex 控制的动作；这些控制步骤不再递归委派。

每次首次派发先查询 list_workspaces 和 list_capabilities，按实际能力目录及用户约定
选择 provider/model/effort。本通用包不绑定某个付费平台；固定路由由部署者另行约定。
模型不可用时如实报告，不静默更换提供商。若原生 start_review 要求显式用户授权标记，
只有用户已明确选择 Harness 时才能填写 explicit-user-request，不伪造授权。

遵循 delegate-to-deepseek-harness 与 dsh-session-hygiene：
只读用 start_review；实施授权明确才用 start_run + workspace-write。
首个运行 sessionMode: fresh，同父任务终态后的续接只用 reply_run。
只传路径和范围，持续 wait_run 到终态，读取 assistantText，再由 Codex 验收。
归档只处理本任务新建、终态已消费且无活动运行的完整 sessionId；用户要求保留时不归档。

只有 DSH 实际不可用、能力或权限不足，或平台/安全要求 Codex 保留控制时，
Codex 才做必要的最小回退，并在结果中说明原因。不得换传输绕过 MCP 或审批失败。
本规则不扩大读写授权，不授权外部消息、上传、push、凭据披露或破坏性操作。
```

与原跨机指南的对应关系：保留“轻量问答不调用、只读实际任务委派、最小回退、fresh 会话与精确归档”的语义；明确控制步骤属于 Codex；将个人固定模型改为部署者约定，避免把个人平台选择误作通用依赖。

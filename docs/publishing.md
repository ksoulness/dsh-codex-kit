# 上传到 GitHub

本文件描述把本仓库推送到 GitHub 的步骤与检查项。仓库的创建、可见性变更和账号动作都需维护者授权后执行；本包自身不含任何建库、push 或发布代码。

## 0. 当前状态

- 仓库已公开：<https://github.com/ksoulness/dsh-codex-kit>，默认分支 `main`，Release `v0.1.0` 已附带源码 ZIP 与 `.sha256`。下文步骤用于后续版本更新或在另一台机器重建发布。
- 仓库内容已可提交：`.gitignore` 排除 `node_modules/`、`.local/`、`*.log`、`__pycache__/`、系统垃圾文件；`.local/` 里是每台机器生成的绝对路径配置，**不要入库**。
- 源码包由 `scripts/package-release.py` 在**仓库目录之外**生成 `dsh-codex-kit-<version>.zip` 与同名 `.sha256`；该 ZIP 不属于仓库内容，作为 Release 附件上传。
- 下一次发布需要维护者先决定：版本号、变更说明，以及是否沿用同一仓库与认证方式。

## 1. 提交前检查

在仓库根执行：

```sh
git status --short --ignored
git ls-files | grep -E '^(node_modules|\.local)/' || echo 'no local data tracked'
npm test
npm run check
npm run verify:relay
```

`git status --ignored` 只应列出被忽略的 `node_modules/`、`.local/`。若 `.local/`、凭据、`relay-endpoint.json`、`*.jsonl` 或 token 文件出现在待提交列表，停止并先用 `.gitignore` 修正。

## 2. 认证（三选一）

本机当前没有 `gh`、没有 GitHub 凭据、`~/.ssh` 下也没有 GitHub 密钥，因此以下任一路线都要先完成第 1 步。

### A. GitHub CLI（改动最少）

```sh
winget install --id GitHub.cli
gh auth login          # 选 GitHub.com → HTTPS → 浏览器登录
gh auth status
```

### B. HTTPS + 个人访问令牌

1. 在 GitHub 生成细粒度 PAT（仅本仓库 `Contents: Read and write`，设置过期时间）。
2. 让 git 通过凭据管理器保存，**不要把令牌写进 remote URL 或提交内容**：

```sh
git config --global credential.helper manager
```

首次 `git push` 时按提示输入用户名与令牌，由凭据管理器加密保存。

### C. SSH 密钥

```sh
ssh-keygen -t ed25519 -C "<你的 GitHub 邮箱>"
# 把 ~/.ssh/id_ed25519.pub 内容添加到 GitHub → Settings → SSH and GPG keys
ssh -T git@github.com
```

远端地址用 `git@github.com:<owner>/<repo>.git`。

## 3. 创建仓库并推送

### A. 用 `gh`

```sh
gh repo create <owner>/<repo> --public --source . --remote origin --push \
  --description "Codex ↔ local DeepSeek Harness delegation and exact session archival"
```

私有仓库把 `--public` 换成 `--private`。若仓库已在网页建好：

```sh
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

### B. 纯 git

```sh
git remote add origin https://github.com/<owner>/<repo>.git   # 或 git@github.com:<owner>/<repo>.git
git push -u origin main
```

推送前确认默认分支名为 `main`（`git branch -M main`），提交身份为维护者本人：

```sh
git config user.name
git config user.email
```

## 4. 发布 Release 附件

```sh
python scripts/package-release.py      # 在仓库根的上一级生成 ZIP 与 .sha256
gh release create v0.1.0 ../dsh-codex-kit-0.1.0.zip ../dsh-codex-kit-0.1.0.zip.sha256 \
  --title "v0.1.0" --generate-notes
```

无 `gh` 时在网页 Release 页面上传 ZIP 与 `.sha256`，并保留 README 中的 SHA-256 文本以便校验。

## 5. 推送后核对

1. 仓库首页 README 正常渲染，许可被识别为 MIT，`LICENSE`、`THIRD_PARTY_NOTICES.md`、`docs/` 可见。
2. 根目录没有 `node_modules/`、`.local/`、`.env`、ZIP 或 token/descriptor 文件。
3. `.agents/plugins/marketplace.json`、`.codex-plugin/plugin.json`、`.mcp.json`、`plugin.json`、`mcp.json` 均存在。
4. 在另一台机器或新目录 `git clone` 后按 `docs/setup.md` 走一遍，确认生成的配置只含该机器路径。
5. Release 附件的 SHA-256 与本地 `.sha256` 文件一致。
6. 仓库描述、topics（如 `mcp`、`deepseek-harness`、`codex`）与可见性符合预期。

## 6. 回退

- 仅撤销本地远端绑定：`git remote remove origin`。
- 删除远端仓库：`gh repo delete <owner>/<repo>`（需二次确认），或网页 Settings → Danger Zone。
- 已推送的错误提交不要强推覆盖他人工作；本仓库为单一维护者时可用 `git push --force-with-lease` 修正，并在提交说明中记录原因。

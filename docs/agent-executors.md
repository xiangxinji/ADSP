# 智能体执行器节点（首版）

ForgePilot 的工作流节点库提供可点击、可拖拽的 **Codex** 与 **Claude Code** 节点。
两者共用资产操作契约、连线、异常端点和执行记录，不引入第二套工作流引擎。

## 使用方式

1. 在全局设置中配置工作空间，先克隆需要引用的仓库。
2. 在工作流中选择根触发器，拖入 Codex 或 Claude Code 节点并连接上游。
3. 选择只读或读写权限（默认只读），勾选当前项目资产，填写自定义提示词。
4. 连接下一节点、保存并运行。后续智能体自动收到上一节点的完整输出；普通节点可通过 `$prev.text` 引用结果。

权限和资产引用是固定配置，不允许从上游数据动态扩大授权范围。提示词允许整个字段使用
`$root.question`、`$prev.text` 等既有取值表达式；不支持在长文本内部使用模板插值。
单个节点最多引用 20 个资产，提示词最多 32000 字符，上下文与上游结果分别最多 128000 字符。

仓库引用提供当前本地工作文件（含未提交修改）的安全快照；知识引用提供正文；
成员仅提供姓名与职责；环境仅提供类型与备注；AI 接口仅提供名称与平台。
不自动跟随知识文档中的其他资产引用，不注入环境账号、密码、AI API Key 或 GitLab Token。
自定义提示词、知识正文、代码和上游结果会发送到所选执行器的外部模型，请只引用允许外发的内容。

## 本机 Runner 配置

Runner 与 ForgePilot 服务运行在同一台机器，通过本地 Docker Linux 引擎启动隔离容器。
平台部署到其他服务器时，访问的是服务器的项目工作空间，不是浏览器所在电脑的文件。
需要 Docker 已启动，且执行环境支持 Codex 内置沙箱；不支持时返回错误，不降级为宿主机直接执行。

在仓库根目录构建本地镜像（不包含项目文件、凭据或用户配置）：

```sh
docker build -t forgepilot-agent-runner:local -f runner/Dockerfile runner
```

镜像固定安装 Codex CLI 0.153.4 和 Claude Code 2.1.161。
可通过 Docker build args `CODEX_VERSION`、`CLAUDE_CODE_VERSION` 显式升级并重新验证兼容性。

在服务端 `.env` 或部署环境中配置执行器专用凭据，然后重启 ForgePilot：

```dotenv
FORGEPILOT_CODEX_API_KEY=<OpenAI API key>
FORGEPILOT_CLAUDE_API_KEY=<Anthropic API key>
FORGEPILOT_AGENT_IMAGE=forgepilot-agent-runner:local
```

首版不自动复用宿主机 CLI 登录态，也不把任意平台 AI 接口 Key 当成两种执行器的通用凭据。
密钥只通过子进程环境注入相应容器，不放入进程参数、提示词、节点定义或运行结果。
如需使用运维管理的 Docker 包装程序，可设置 `FORGEPILOT_AGENT_DOCKER_COMMAND` 为 JSON 字符串数组
（例如 `["/opt/bin/docker-wrapper"]`）；此配置仅限受信任的服务端运维，不能由工作流传入。
不会自动拉取镜像或在缺少环境时安装软件。

## 文件与执行边界

临时快照位于 `<workspace>/projects/<project-id>/agent-runs/<run-id>/`，只复制显式引用的仓库。
每个仓库最多 10000 个文件、64 MiB。排除 `.git`、`node_modules`、`.nuxt`、`.output`、`.data`、
执行器项目配置、已知凭据目录、`.env*`、`.npmrc`、`.netrc` 和常见密钥文件；其他未识别文件仍可能含敏感信息，
操作者需要自行审查。拒绝符号链接、junction、硬链接及特殊文件，不跟随链接访问其他项目。

容器使用非 root 用户、只读系统盘、受限资源和独立临时 HOME，不挂载 Docker socket、原仓库、
宿主机 HOME 或控制平面数据库。只读节点的代码快照采用只读挂载；读写节点只能修改快照。
Codex 保留 read-only/workspace-write 沙箱并禁止 shell 网络；Claude Code 仅开放 Read/Glob/Grep，
读写时增加 Edit/Write，不开放 Bash、外部 MCP、宿主机插件和 hooks。
因此首版不是任意命令执行节点，不承诺能安装依赖、构建或运行测试。

只有进程及语义结果均成功时才应用读写结果。应用前验证路径、排除文件和原文件哈希；
发现并发修改拒绝覆盖，不自动提交 Git。失败、超时与只读任务不应用代码修改。
应用阶段的文件系统错误可能导致部分已验证文件写入，应检查工作树；不会自动重试有写入副作用的任务。
任务结束清理快照。服务异常退出可能留下快照；容器内另有 600 秒进程期限，避免永久运行。
当前仍沿用服务重启将运行中工作流标记为 `workflow.interrupted` 的行为，不增加恢复或取消机制。

## 契约与错误

两个项目级操作为 `repository.agent-codex`、`repository.agent-claude-code`。
HTTP 入口：`POST /api/projects/:id/assets/repository/operations/:operationId`。

```json
{
  "prompt": "梳理登录鉴权调用链，提供代码位置和风险。",
  "writable": false,
  "references": [{ "assetType": "repository", "assetId": "仓库资产 ID" }]
}
```

返回 `{ "text": "最终结果", "executor": "codex", "writable": false, "durationMs": 1234 }`。
工作流会自动为调用注入 `upstream`（JSON 文本），首节点使用根输入；成功后完整输出成为下一份 `$prev`。
单次执行上限 10 分钟，原始 CLI 输出上限 2 MiB，最终正文上限 120000 字符。
缺少凭据、引擎不可用、执行失败、无效输出、文件冲突均使用共享契约中的 `agent.*` 错误码；
异常处理由现有异常端点配置，不依赖翻译后的错误文本。

当前首版采用确定性执行器替身验证 API、流程串联和文件写回，并单独测试 CLI 参数与结果协议。
这些测试不能替代真实 Docker、执行器版本、模型凭据及沙箱的部署验收。

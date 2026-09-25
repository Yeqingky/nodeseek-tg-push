# NodeSeek Telegram Push

由 TS + Node.js 编写的 通过爬取NodeSeek Telegram推送频道的关键词推送Bot .


## 安装与启动

### 源码运行

要求 Node.js 22.13 或更新版本。

```sh
npm install
cp -n .env.example .env
```

在 `.env` 中填写 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_TARGET_CHAT_ID`。将 Bot 添加到目标群组或频道, 并授予发送消息的权限。目标可以是数字 chat ID, 也可以是公开频道用户名, 例如 `@my_channel`。

运行类型检查并构建:

```sh
npm run typecheck
npm run build
```

启动轮询服务:

```sh
npm start
```

开发时可以运行 `npm run dev`。`npm start` 通过 `tsx` 直接执行 TypeScript, 不依赖 `dist`。程序通过 Node.js 的 `--env-file-if-exists` 参数自动读取 `.env`。`.env` 已加入 Git 忽略规则, 不要提交真实凭据。

## Docker 镜像

镜像基于 `node:22-alpine`, 容器启动时直接运行 `npm start`, 不生成独立二进制文件。当前发布 `linux/amd64` 和 `linux/arm64` 多架构镜像。

GitHub Actions 在每次分支 push 和 `v*.*.*` tag push 时构建并推送镜像。普通提交使用 7 位短 SHA 作为镜像 tag; 符合 `vX.Y.Z` 的 tag 会发布 `X.Y.Z` 和 `latest`。Pull request 只构建验证, 不推送镜像; 工作流不会创建 GitHub Release。镜像发布到 GHCR, 使用 Actions 自带的 `GITHUB_TOKEN`; 首次发布后可在 package 设置中将可见性改为 Public。

```sh
docker run -d --name nodeseek-tg-push --restart unless-stopped --env-file .env --mount source=nodeseek-data,target=/app/data ghcr.io/yeqingky/nodeseek-tg-push:latest
```

## 配置

所有运行配置都从 `.env` 读取。不同用途的变量以空行分组:

```dotenv
# 启用监听来源. 当前仅为 nodeseek.
ENABLED_SOURCES=nodeseek

# Telegram 推送目标
TELEGRAM_BOT_TOKEN=
TELEGRAM_TARGET_CHAT_ID=

# NodeSeek 监听源
NODESEEK_SOURCE_CHANNEL=nodeseekc
NODESEEK_POLL_INTERVAL_MS=60000
NODESEEK_MAX_PAGES_PER_POLL=100

# NodeSeek 关键词过滤. 默认关闭.
NODESEEK_FILTER_ENABLED=false
# blacklist 命中时跳过; whitelist 仅推送命中项.
NODESEEK_FILTER_MODE=blacklist
# 标题关键词, 使用逗号分隔.
NODESEEK_FILTER_KEYWORDS=

# 通用运行配置
REQUEST_TIMEOUT_MS=15000
# SQLite 文件, 每个来源只保留最后扫描到的 URL, 不保存帖子正文.
DATABASE_PATH=./data/state.sqlite
```

`ENABLED_SOURCES` 默认值为 `nodeseek`。目前只有 `nodeseek` 监听器会实际运行; 其他来源名称会被接受, 但在对应监听器实现前不会产生监听行为。`NODESEEK_FILTER_ENABLED` 默认 `false`; 启用后, `NODESEEK_FILTER_MODE` 可设为 `blacklist` 或 `whitelist`, 且 `NODESEEK_FILTER_KEYWORDS` 不能为空, 使用逗号分隔关键词。标题关键词进行不区分大小写的子串匹配。被过滤的帖子仍更新扫描 URL; 白名单未命中日志示例为 `(white: 免费)`, 黑名单命中为 `(Black: 推荐)`。为保持现有本地 `.env` 可用, 程序暂时兼容旧变量名 `TELEGRAM_SOURCE_CHANNEL`、`POLL_INTERVAL_MS` 和 `MAX_PAGES_PER_POLL`; 新配置请使用上面的 `NODESEEK_*` 变量。

如果在 `NODESEEK_MAX_PAGES_PER_POLL` 限制内仍未找到已保存的扫描 URL, 本轮会失败且不会推进游标。首次成功运行时只处理最新关联帖子; 此后只扫描 NodeSeek ID 更大的帖子。

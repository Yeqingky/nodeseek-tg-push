# NodeSeek Telegram Push

由 TS + Node.js 编写的关键词推送 Bot. 支持两个监听来源: NodeSeek Telegram 推送频道 (@nodeseekc) 与烧饼论坛 RSS (https://sb.sb/rss.xml).


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

### Docker Compose

仓库自带 `compose.yml`, 使用 GHCR 的 `latest` 镜像, 并将本机 `.env` 和 `./data` 挂载到容器:

```sh
mkdir -p data
chown -R 1000:1000 data
chmod 750 data
docker compose pull
docker compose up -d
docker compose logs -f nodeseek-tg-push
```

更新镜像时再次执行 `docker compose pull` 和 `docker compose up -d`; 停止服务使用 `docker compose down`, `data/` 中的游标文件会保留。

## 配置

所有运行配置都从 `.env` 读取。不同用途的变量以空行分组:

```dotenv
# 启用监听来源. 可选 nodeseek 和 sbsb.
ENABLED_SOURCES=nodeseek

# Telegram 推送目标
TELEGRAM_BOT_TOKEN=
TELEGRAM_TARGET_CHAT_ID=

# 通用运行配置
# 两个来源共用的轮询间隔.
POLL_INTERVAL_MS=60000
REQUEST_TIMEOUT_MS=15000
# SQLite 文件, 每个来源只保留最后扫描到的 URL, 不保存帖子正文.
DATABASE_PATH=./data/state.sqlite

# 全局黑名单, 命中标题时跳过, 对所有来源生效. 留空表示不启用.
GLOBAL_BLACKLIST_KEYWORDS=

# NodeSeek 抓取参数
NODESEEK_MAX_PAGES_PER_POLL=100

# NodeSeek 关键词过滤. 默认关闭.
NODESEEK_FILTER_ENABLED=false
# blacklist 命中时跳过; whitelist 仅推送命中项.
NODESEEK_FILTER_MODE=blacklist
# 标题关键词, 使用逗号分隔.
NODESEEK_FILTER_KEYWORDS=

# 烧饼论坛关键词过滤. 默认关闭.
SBSB_FILTER_ENABLED=false
# blacklist 命中时跳过; whitelist 仅推送命中项.
SBSB_FILTER_MODE=blacklist
# 标题关键词, 使用逗号分隔.
SBSB_FILTER_KEYWORDS=
```

`ENABLED_SOURCES` 默认值为 `nodeseek`。只有列出的来源会运行, 目前可填 `nodeseek` 和 `sbsb`; 未识别的名称会被忽略, 并在启动日志中输出 `Ignored unknown sources`。两个来源共用 `POLL_INTERVAL_MS`。

关键词过滤顺序为 "先全局, 后来源", 只匹配标题, 不区分大小写并使用子串匹配:

1. `GLOBAL_BLACKLIST_KEYWORDS` 命中时直接跳过, 日志标记为 `(Global: 关键词)`; 留空表示不启用.
2. 再应用来源自己的 `NODESEEK_FILTER_*` 或 `SBSB_FILTER_*`; 黑名单命中日志为 `(Black: 关键词)`, 白名单未命中日志为 `(white: 关键词)`.

两个来源的过滤开关默认都是 `false`; 启用时必须填写对应的关键词列表。被过滤的帖子仍会推进扫描游标, 不会在下一轮重复评估。

消息格式:

- NodeSeek: 两行, `主题: <标题>` 和 `链接: <URL>`, 不含摘要.
- 烧饼论坛: 前两行与 NodeSeek 相同, 空一行后追加 RSS `description` 正文; 超过 Telegram 4096 字符上限时优先压缩正文, 正文为空时退化为两行.

为保持现有本地 `.env` 可用, 程序兼容旧变量名 `NODESEEK_POLL_INTERVAL_MS` 和 `MAX_PAGES_PER_POLL`; 新配置请使用上面的变量名.

两个来源首次成功运行时都只处理最新一篇帖子, 此后只处理 ID 更大的帖子。NodeSeek 如果在 `NODESEEK_MAX_PAGES_PER_POLL` 限制内仍未找到已保存的扫描 URL, 本轮会失败且不会推进游标; 烧饼论坛 RSS 固定返回最新 50 篇帖子, 如果游标已不在 RSS 窗口内 (期间新增超过 50 篇), 会推送窗口内的全部帖子, 并在日志中提示可能漏帖。发送失败的帖子不会推进游标, 下一轮会重试.

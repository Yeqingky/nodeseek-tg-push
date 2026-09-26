# AGENTS.md

## Repository Purpose

Poll a public Telegram channel preview and the 烧饼论坛 RSS feed, then forward newly discovered NodeSeek and 烧饼论坛 posts to one Telegram destination.

## Code Navigation

- `src/parser.ts`: parse Telegram preview HTML and extract NodeSeek post IDs and links.
- `src/poller.ts`: scan Telegram preview pages in ID order and update the NodeSeek scan cursor.
- `src/rss-parser.ts`: parse the 烧饼论坛 RSS feed into post IDs, canonical URLs, titles, and description bodies.
- `src/sbsb-poller.ts`: compare RSS post IDs with the saved cursor and deliver new posts in ascending order.
- `src/delivery.ts`: shared filter-then-send delivery flow and scan cursor update.
- `src/filter.ts`: global blacklist followed by per-source whitelist or blacklist, matched against titles.
- `src/message-format.ts`: build two-line NodeSeek messages and 烧饼论坛 messages with the description body.
- `src/source.ts`: HTTP fetch helpers for Telegram preview HTML and RSS XML.
- `src/state-store.ts`: WAL-enabled SQLite scan cursor storing one URL per source, with no post details.
- `src/telegram.ts`: Telegram Bot API delivery.
- `src/config.ts`: validate Telegram delivery settings, enabled sources, filters, and source parameters loaded from `.env`.
- `src/logger.ts`: format timestamped source logs.
- `src/index.ts`: polling lifecycle and timestamped service logs.
- `Dockerfile`: Alpine Node.js runtime that starts the TypeScript entry point with `npm start`.
- `compose.yml`: deploy the GHCR image with the local `.env` and `./data` bind mounts.
- `.github/workflows/docker.yml`: CI verification and GHCR multi-platform image publishing.

## Development and Verification

- Install dependencies with `npm install`.
- Type-check with `npm run typecheck`.
- Build with `npm run build`.
- Validate the Compose file with `docker compose config`.
- Configure `.env` from `.env.example`, then run `npm start`.

## Required Behavior

- Use the NodeSeek post ID from the linked URL, and the 烧饼论坛 post ID from the RSS `link` or `guid` (`/t/<id>/`), as deduplication keys.
- Process newly discovered IDs in ascending order.
- Store only one last-scanned post URL per source; never persist post text, excerpts, or message bodies.
- Match keyword filters against titles only, case-insensitively, in order: global blacklist first, then the source whitelist or blacklist.
- Format NodeSeek messages as exactly two lines, `主题: <title>` and `链接: <URL>`; omit excerpts.
- Format 烧饼论坛 messages as `主题: <title>`, `链接: <URL>`, then a blank line and the RSS `description` body; truncate to the Telegram message limit.
- Advance the scan URL for posts rejected by filter rules so they are not evaluated again.
- Leave the URL unchanged when a matched post's Telegram send fails so the next poll can retry it.
- Deliver only the newest post on a source's first run; later runs deliver posts with larger IDs.
- Poll the hardcoded NodeSeek Telegram preview channel `@nodeseekc`; the channel name is not configurable.
- Read the hardcoded 烧饼论坛 RSS endpoint `https://sb.sb/rss.xml`, which lists only the latest 50 items; log when the saved cursor has fallen out of the window and posts may have been missed.
- Keep Telegram source scraping and Telegram destination delivery separate.
- Accept comma-separated source identifiers in `ENABLED_SOURCES`; run a listener only when its identifier (`nodeseek` or `sbsb`) is selected, and log unrecognized identifiers.
- Share one `POLL_INTERVAL_MS` between sources; keep legacy environment variable names working.
- Format delivery logs with a check mark and skipped logs with a cross, timestamp, source name, URL, and filter reason when skipped.
- Publish Docker images to GHCR on branch and version-tag pushes; do not create GitHub Releases.
- Run the container from `node:22-alpine` with `npm start`; publish `linux/amd64` and `linux/arm64` images.
- Do not commit `.env`, bot credentials, or the SQLite database.

# AGENTS.md

## Repository Purpose

Poll a public Telegram channel preview, extract linked NodeSeek posts, and forward newly discovered posts to one Telegram destination.

## Code Navigation

- `src/parser.ts`: parse Telegram preview HTML and extract NodeSeek post IDs and links.
- `src/poller.ts`: scan source pages in ID order, apply per-source delivery filters, and update the scan cursor.
- `src/state-store.ts`: WAL-enabled SQLite scan cursor storing one URL per source, with no post details.
- `src/telegram.ts`: Telegram Bot API delivery.
- `src/config.ts`: validate Telegram delivery settings and enabled sources loaded from `.env`.
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

- Use the NodeSeek post ID from the linked URL as the deduplication key.
- Process newly discovered IDs in ascending order.
- Store only one last-scanned post URL per source; never persist post text, excerpts, or message bodies.
- Apply NodeSeek keyword filtering to the title only.
- Format Telegram messages as exactly two lines, `主题: <title>` and `链接: <URL>`; omit excerpts.
- Advance the scan URL for posts filtered out by source rules so they are not evaluated again.
- Leave the URL unchanged when a matched post's Telegram send fails so the next poll can retry it.
- Keep Telegram source scraping and Telegram destination delivery separate.
- Accept comma-separated source identifiers in `ENABLED_SOURCES`; run the NodeSeek listener only when `nodeseek` is selected.
- Format delivery logs with a check mark and skipped logs with a cross, timestamp, source name, URL, and filter reason when skipped.
- Publish Docker images to GHCR on branch and version-tag pushes; do not create GitHub Releases.
- Run the container from `node:22-alpine` with `npm start`; publish `linux/amd64` and `linux/arm64` images.
- Do not commit `.env`, bot credentials, or the SQLite database.

import type { AppConfig } from "./config.js";
import { formatPostMessage } from "./message-format.js";
import { formatLogLine } from "./logger.js";
import { evaluatePostFilter } from "./filter.js";
import { parseNodeSeekPostUrl, parseTelegramPage } from "./parser.js";
import { fetchSourceHtml } from "./source.js";
import { StateStore } from "./state-store.js";
import type { SourcePost } from "./types.js";

const SOURCE_NAME = "nodeseek";

export interface PollerDependencies {
  store: StateStore;
  sendTelegram: (message: string) => Promise<void>;
  fetchHtml?: (url: string, timeoutMs: number) => Promise<string>;
  log?: (message: string) => void;
}

export class ChannelPoller {
  private readonly fetchHtml: (url: string, timeoutMs: number) => Promise<string>;
  private readonly log: (message: string) => void;

  constructor(
    private readonly config: Pick<
      AppConfig,
      | "sourceChannel"
      | "requestTimeoutMs"
      | "maxPagesPerPoll"
      | "nodeSeekFilterEnabled"
      | "nodeSeekFilterMode"
      | "nodeSeekFilterKeywords"
    >,
    private readonly dependencies: PollerDependencies,
  ) {
    this.fetchHtml = dependencies.fetchHtml ?? fetchSourceHtml;
    this.log = dependencies.log ?? ((message) => console.info(message));
  }

  async pollOnce(): Promise<void> {
    const scannedUrl = this.dependencies.store.getScannedUrl(SOURCE_NAME);
    const parsedScannedUrl = scannedUrl === null ? null : parseNodeSeekPostUrl(scannedUrl);
    if (scannedUrl !== null && parsedScannedUrl === null) {
      throw new Error(`Invalid saved NodeSeek scan URL: ${scannedUrl}`);
    }
    const scannedId = parsedScannedUrl?.nodeSeekId ?? null;

    if (scannedId === null) {
      const latestPost = await this.findLatestPost();
      if (latestPost) {
        await this.deliver(latestPost);
      }
      return;
    }

    const newPosts = await this.findPostsAfter(scannedId);
    for (const post of newPosts) {
      await this.deliver(post);
    }
  }

  private async findLatestPost(): Promise<SourcePost | null> {
    let before: number | null = null;
    for (let pageNumber = 0; pageNumber < this.config.maxPagesPerPoll; pageNumber += 1) {
      const page = await this.loadPage(before);
      const latestPost = page.posts.at(-1);
      if (latestPost) {
        return latestPost;
      }
      if (page.nextBefore === null) {
        return null;
      }
      this.assertCursorProgress(before, page.nextBefore);
      before = page.nextBefore;
    }
    throw new Error(`No linked NodeSeek post found within ${this.config.maxPagesPerPoll} Telegram pages`);
  }

  private async findPostsAfter(checkpointId: number): Promise<SourcePost[]> {
    const found = new Map<number, SourcePost>();
    let before: number | null = null;

    for (let pageNumber = 0; pageNumber < this.config.maxPagesPerPoll; pageNumber += 1) {
      const page = await this.loadPage(before);
      for (const post of page.posts) {
        if (post.nodeSeekId > checkpointId) {
          found.set(post.nodeSeekId, post);
        }
      }

      if (page.posts.some((post) => post.nodeSeekId <= checkpointId)) {
        return [...found.values()].sort((left, right) => left.nodeSeekId - right.nodeSeekId);
      }
      if (page.nextBefore === null) {
        return [...found.values()].sort((left, right) => left.nodeSeekId - right.nodeSeekId);
      }
      this.assertCursorProgress(before, page.nextBefore);
      before = page.nextBefore;
    }

    throw new Error(`Could not reach saved NodeSeek ID ${checkpointId} within ${this.config.maxPagesPerPoll} Telegram pages`);
  }

  private async loadPage(before: number | null) {
    const url = new URL(`https://t.me/s/${encodeURIComponent(this.config.sourceChannel)}`);
    if (before !== null) {
      url.searchParams.set("before", String(before));
    }

    const html = await this.fetchHtml(url.toString(), this.config.requestTimeoutMs);
    const page = parseTelegramPage(html);
    if (page.messageCount === 0) {
      throw new Error("Telegram preview contained no messages; access may be blocked or the page structure may have changed");
    }
    return page;
  }

  private assertCursorProgress(previous: number | null, next: number): void {
    if (previous !== null && next >= previous) {
      throw new Error("Telegram pagination cursor did not move backward");
    }
  }

  private async deliver(post: SourcePost): Promise<void> {
    const decision = evaluatePostFilter(post, {
      enabled: this.config.nodeSeekFilterEnabled,
      mode: this.config.nodeSeekFilterMode,
      keywords: this.config.nodeSeekFilterKeywords,
    });
    if (!decision.shouldPush) {
      this.dependencies.store.setScannedUrl(SOURCE_NAME, post.url);
      this.log(formatLogLine("✗ NodeSeek", `${post.url} (${decision.reason})`));
      return;
    }

    await this.dependencies.sendTelegram(formatPostMessage(post));
    this.dependencies.store.setScannedUrl(SOURCE_NAME, post.url);
    this.log(formatLogLine("✓ NodeSeek", post.url));
  }
}

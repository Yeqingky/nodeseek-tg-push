import type { AppConfig } from "./config.js";
import { deliverPost } from "./delivery.js";
import { parseNodeSeekPostUrl, parseTelegramPage } from "./parser.js";
import { fetchSourceHtml } from "./source.js";
import { StateStore } from "./state-store.js";
import type { SourcePost } from "./types.js";

const SOURCE_NAME = "nodeseek";
const LOG_NAME = "NodeSeek";
export const NODESEEK_SOURCE_CHANNEL = "nodeseekc";

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
      | "requestTimeoutMs"
      | "nodeSeekMaxPagesPerPoll"
      | "nodeSeekFilterEnabled"
      | "nodeSeekFilterMode"
      | "nodeSeekFilterKeywords"
      | "globalBlacklistKeywords"
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
    const scannedId = parsedScannedUrl?.postId ?? null;

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
    for (let pageNumber = 0; pageNumber < this.config.nodeSeekMaxPagesPerPoll; pageNumber += 1) {
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
    throw new Error(`No linked NodeSeek post found within ${this.config.nodeSeekMaxPagesPerPoll} Telegram pages`);
  }

  private async findPostsAfter(checkpointId: number): Promise<SourcePost[]> {
    const found = new Map<number, SourcePost>();
    let before: number | null = null;

    for (let pageNumber = 0; pageNumber < this.config.nodeSeekMaxPagesPerPoll; pageNumber += 1) {
      const page = await this.loadPage(before);
      for (const post of page.posts) {
        if (post.postId > checkpointId) {
          found.set(post.postId, post);
        }
      }

      if (page.posts.some((post) => post.postId <= checkpointId)) {
        return [...found.values()].sort((left, right) => left.postId - right.postId);
      }
      if (page.nextBefore === null) {
        return [...found.values()].sort((left, right) => left.postId - right.postId);
      }
      this.assertCursorProgress(before, page.nextBefore);
      before = page.nextBefore;
    }

    throw new Error(`Could not reach saved NodeSeek ID ${checkpointId} within ${this.config.nodeSeekMaxPagesPerPoll} Telegram pages`);
  }

  private async loadPage(before: number | null) {
    const url = new URL(`https://t.me/s/${encodeURIComponent(NODESEEK_SOURCE_CHANNEL)}`);
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
    await deliverPost(
      {
        store: this.dependencies.store,
        sendTelegram: this.dependencies.sendTelegram,
        log: this.log,
      },
      {
        source: SOURCE_NAME,
        logName: LOG_NAME,
        includeExcerpt: false,
        filter: {
          globalBlacklistKeywords: this.config.globalBlacklistKeywords,
          source: {
            enabled: this.config.nodeSeekFilterEnabled,
            mode: this.config.nodeSeekFilterMode,
            keywords: this.config.nodeSeekFilterKeywords,
          },
        },
      },
      post,
    );
  }
}

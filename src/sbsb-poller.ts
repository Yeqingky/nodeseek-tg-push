import type { AppConfig } from "./config.js";
import { deliverPost } from "./delivery.js";
import { formatLogLine } from "./logger.js";
import { parseRssFeed, parseSbPostUrl } from "./rss-parser.js";
import { fetchSourceXml } from "./source.js";
import { StateStore } from "./state-store.js";
import type { SourcePost } from "./types.js";

const SOURCE_NAME = "sbsb";
const LOG_NAME = "Sbsb";
export const SBSB_RSS_URL = "https://sb.sb/rss.xml";

export interface SbsbPollerDependencies {
  store: StateStore;
  sendTelegram: (message: string) => Promise<void>;
  fetchXml?: (url: string, timeoutMs: number) => Promise<string>;
  log?: (message: string) => void;
}

export class SbsbPoller {
  private readonly fetchXml: (url: string, timeoutMs: number) => Promise<string>;
  private readonly log: (message: string) => void;

  constructor(
    private readonly config: Pick<
      AppConfig,
      | "requestTimeoutMs"
      | "sbsbFilterEnabled"
      | "sbsbFilterMode"
      | "sbsbFilterKeywords"
      | "globalBlacklistKeywords"
    >,
    private readonly dependencies: SbsbPollerDependencies,
  ) {
    this.fetchXml = dependencies.fetchXml ?? fetchSourceXml;
    this.log = dependencies.log ?? ((message) => console.info(message));
  }

  async pollOnce(): Promise<void> {
    const scannedUrl = this.dependencies.store.getScannedUrl(SOURCE_NAME);
    const scannedPost = scannedUrl === null ? null : parseSbPostUrl(scannedUrl);
    if (scannedUrl !== null && scannedPost === null) {
      throw new Error(`Invalid saved Sbsb scan URL: ${scannedUrl}`);
    }

    const feed = await this.loadFeed();
    if (feed.itemCount === 0) {
      throw new Error("Sbsb RSS feed contained no items");
    }
    if (feed.posts.length === 0) {
      throw new Error("Sbsb RSS feed items contained no post links");
    }

    const latestPost = feed.posts.at(-1);
    if (scannedPost === null) {
      if (latestPost) {
        await this.deliver(latestPost);
      }
      return;
    }

    const newPosts = feed.posts.filter((post) => post.postId > scannedPost.postId);
    const oldestAvailablePost = feed.posts[0];
    if (newPosts.length > 0 && oldestAvailablePost && oldestAvailablePost.postId > scannedPost.postId) {
      this.log(formatLogLine(
        LOG_NAME,
        `RSS window starts at ${oldestAvailablePost.postId}; posts up to ${scannedPost.postId} may have been missed`,
      ));
    }
    for (const post of newPosts) {
      await this.deliver(post);
    }
  }

  private async loadFeed() {
    const xml = await this.fetchXml(SBSB_RSS_URL, this.config.requestTimeoutMs);
    return parseRssFeed(xml);
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
        includeExcerpt: true,
        filter: {
          globalBlacklistKeywords: this.config.globalBlacklistKeywords,
          source: {
            enabled: this.config.sbsbFilterEnabled,
            mode: this.config.sbsbFilterMode,
            keywords: this.config.sbsbFilterKeywords,
          },
        },
      },
      post,
    );
  }
}

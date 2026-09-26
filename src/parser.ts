import { load } from "cheerio";
import type { ParsedTelegramPage, SourcePost } from "./types.js";

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseNodeSeekPostUrl(href: string): { postId: number; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(href, "https://www.nodeseek.com");
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "nodeseek.com" && hostname !== "www.nodeseek.com") {
    return null;
  }

  const match = parsed.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
  if (!match) {
    return null;
  }

  const nodeSeekId = Number(match[1]);
  if (!Number.isSafeInteger(nodeSeekId)) {
    return null;
  }

  return {
    postId: nodeSeekId,
    url: `https://www.nodeseek.com${parsed.pathname.replace(/\/$/, "")}`,
  };
}

export function parseTelegramPage(html: string): ParsedTelegramPage {
  const $ = load(html);
  const messages = $(".tgme_widget_message[data-post]");
  const posts: SourcePost[] = [];
  const seenPostIds = new Set<number>();

  messages.each((_index, element) => {
    const message = $(element);
    const telegramIdMatch = message.attr("data-post")?.match(/\/(\d+)$/);
    const sourceMessageId = Number(telegramIdMatch?.[1]);
    if (!Number.isSafeInteger(sourceMessageId)) {
      return;
    }

    const text = cleanText(message.find(".js-message_text").first().text())
      || cleanText(message.find(".link_preview_title").first().text());
    const excerpt = cleanText(message.find(".link_preview_description").first().text());
    const publishedAt = message.find("time.time").first().attr("datetime") ?? null;
    const links = new Map<number, string>();

    message.find("a[href]").each((_linkIndex, anchor) => {
      const href = $(anchor).attr("href");
      if (!href) {
        return;
      }
      const postLink = parseNodeSeekPostUrl(href);
      if (postLink) {
        links.set(postLink.postId, postLink.url);
      }
    });

    for (const [postId, url] of links) {
      if (seenPostIds.has(postId)) {
        continue;
      }
      seenPostIds.add(postId);
      posts.push({ postId, url, sourceMessageId, text, excerpt, publishedAt });
    }
  });

  const beforeValue = $(".js-messages_more[data-before]").first().attr("data-before");
  const parsedBefore = beforeValue ? Number(beforeValue) : null;
  const nextBefore = parsedBefore !== null && Number.isSafeInteger(parsedBefore) && parsedBefore > 0
    ? parsedBefore
    : null;

  posts.sort((left, right) => left.postId - right.postId);
  return { posts, messageCount: messages.length, nextBefore };
}

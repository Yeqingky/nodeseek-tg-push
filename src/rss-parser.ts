import { load } from "cheerio";
import type { ParsedRssFeed, SourcePost } from "./types.js";

const DEFAULT_BASE_URL = "https://sb.sb";

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseSbPostUrl(href: string): { postId: number; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(href, DEFAULT_BASE_URL);
  } catch {
    return null;
  }

  const match = parsed.pathname.match(/^\/t\/(\d+)\/?$/);
  if (!match) {
    return null;
  }

  const postId = Number(match[1]);
  if (!Number.isSafeInteger(postId)) {
    return null;
  }

  return {
    postId,
    url: `${parsed.origin}/t/${postId}/`,
  };
}

export function parseRssFeed(xml: string): ParsedRssFeed {
  const $ = load(xml, { xmlMode: true });
  const items = $("item");
  const posts: SourcePost[] = [];
  const seenPostIds = new Set<number>();

  items.each((_index, element) => {
    const item = $(element);
    const href = item.find("link").first().text().trim()
      || item.find("guid").first().text().trim();
    const postLink = parseSbPostUrl(href);
    if (!postLink || seenPostIds.has(postLink.postId)) {
      return;
    }

    seenPostIds.add(postLink.postId);
    posts.push({
      postId: postLink.postId,
      url: postLink.url,
      sourceMessageId: null,
      text: cleanText(item.find("title").first().text()),
      excerpt: cleanText(item.find("description").first().text()),
      publishedAt: item.find("pubDate").first().text().trim() || null,
    });
  });

  posts.sort((left, right) => left.postId - right.postId);
  return { posts, itemCount: items.length };
}

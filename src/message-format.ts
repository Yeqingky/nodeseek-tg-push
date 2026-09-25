import type { SourcePost } from "./types.js";

const TELEGRAM_MESSAGE_LIMIT = 4096;
const TITLE_PREFIX = "主题: ";
const LINK_PREFIX = "链接: ";

function truncateUtf16(value: string, maxLength: number): string {
  let output = "";
  for (const character of value) {
    if (output.length + character.length > maxLength) {
      break;
    }
    output += character;
  }
  return output;
}

export function formatPostMessage(post: SourcePost): string {
  const title = post.text.replace(/\s+/g, " ").trim();
  const linkLine = `${LINK_PREFIX}${post.url}`;
  const maxTitleLength = Math.max(0, TELEGRAM_MESSAGE_LIMIT - TITLE_PREFIX.length - 1 - linkLine.length);
  const truncatedTitle = truncateUtf16(title, maxTitleLength);
  return `${TITLE_PREFIX}${truncatedTitle}\n${linkLine}`;
}

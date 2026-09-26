import type { SourcePost } from "./types.js";

const TELEGRAM_MESSAGE_LIMIT = 4096;
const TITLE_PREFIX = "主题: ";
const LINK_PREFIX = "链接: ";
const BODY_SEPARATOR = "\n\n";

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

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export interface MessageFormatOptions {
  includeExcerpt?: boolean;
}

export function formatPostMessage(
  post: SourcePost,
  options: MessageFormatOptions = {},
): string {
  const title = normalize(post.text);
  const linkLine = `${LINK_PREFIX}${post.url}`;
  const titleBudget = Math.max(0, TELEGRAM_MESSAGE_LIMIT - TITLE_PREFIX.length - 1 - linkLine.length);
  const excerpt = options.includeExcerpt ? normalize(post.excerpt) : "";
  const bodyBudget = titleBudget - BODY_SEPARATOR.length;

  if (!excerpt || bodyBudget <= 0) {
    return `${TITLE_PREFIX}${truncateUtf16(title, titleBudget)}\n${linkLine}`;
  }

  const provisionalTitleLength = Math.min(title.length, Math.floor(bodyBudget / 2));
  const body = truncateUtf16(excerpt, bodyBudget - provisionalTitleLength);
  const truncatedTitle = truncateUtf16(title, bodyBudget - body.length);
  return `${TITLE_PREFIX}${truncatedTitle}\n${linkLine}${BODY_SEPARATOR}${body}`;
}

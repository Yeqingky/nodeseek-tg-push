import type { SourcePost } from "./types.js";

export type KeywordFilterMode = "blacklist" | "whitelist";

export interface KeywordFilterSettings {
  enabled: boolean;
  mode: KeywordFilterMode;
  keywords: readonly string[];
}

export type KeywordFilterDecision =
  | { shouldPush: true; reason: null }
  | { shouldPush: false; reason: string };

export function evaluatePostFilter(
  post: SourcePost,
  settings: KeywordFilterSettings,
): KeywordFilterDecision {
  if (!settings.enabled) {
    return { shouldPush: true, reason: null };
  }

  const searchableText = post.text.toLowerCase();
  const keywords = [...new Set(settings.keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  const matches = keywords.filter((keyword) =>
    searchableText.includes(keyword.toLowerCase())
  );

  if (settings.mode === "blacklist" && matches.length > 0) {
    return { shouldPush: false, reason: `Black: ${matches.join(", ")}` };
  }
  if (settings.mode === "whitelist" && matches.length === 0) {
    return { shouldPush: false, reason: `white: ${keywords.join(", ")}` };
  }
  return { shouldPush: true, reason: null };
}

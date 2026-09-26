export type KeywordFilterMode = "blacklist" | "whitelist";

export interface KeywordFilterSettings {
  enabled: boolean;
  mode: KeywordFilterMode;
  keywords: readonly string[];
}

export interface PostFilterSettings {
  globalBlacklistKeywords: readonly string[];
  source: KeywordFilterSettings;
}

export type KeywordFilterDecision =
  | { shouldPush: true; reason: null }
  | { shouldPush: false; reason: string };

function normalizeKeywords(keywords: readonly string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

function findMatches(searchableText: string, keywords: readonly string[]): string[] {
  return keywords.filter((keyword) => searchableText.includes(keyword.toLowerCase()));
}

export function evaluatePostFilter(
  title: string,
  settings: PostFilterSettings,
): KeywordFilterDecision {
  const searchableText = title.toLowerCase();

  const globalMatches = findMatches(searchableText, normalizeKeywords(settings.globalBlacklistKeywords));
  if (globalMatches.length > 0) {
    return { shouldPush: false, reason: `Global: ${globalMatches.join(", ")}` };
  }

  if (!settings.source.enabled) {
    return { shouldPush: true, reason: null };
  }

  const keywords = normalizeKeywords(settings.source.keywords);
  const matches = findMatches(searchableText, keywords);

  if (settings.source.mode === "blacklist" && matches.length > 0) {
    return { shouldPush: false, reason: `Black: ${matches.join(", ")}` };
  }
  if (settings.source.mode === "whitelist" && matches.length === 0) {
    return { shouldPush: false, reason: `white: ${keywords.join(", ")}` };
  }
  return { shouldPush: true, reason: null };
}

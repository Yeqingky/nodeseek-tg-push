import type { KeywordFilterMode } from "./filter.js";

export interface AppConfig {
  botToken: string;
  targetChatId: string;
  enabledSources: string[];
  pollIntervalMs: number;
  requestTimeoutMs: number;
  globalBlacklistKeywords: string[];
  nodeSeekMaxPagesPerPoll: number;
  nodeSeekFilterEnabled: boolean;
  nodeSeekFilterMode: KeywordFilterMode;
  nodeSeekFilterKeywords: string[];
  sbsbFilterEnabled: boolean;
  sbsbFilterMode: KeywordFilterMode;
  sbsbFilterKeywords: string[];
  databasePath: string;
}

interface FilterSettings {
  enabled: boolean;
  mode: KeywordFilterMode;
  keywords: string[];
}

function requiredValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
): number {
  const rawValue = env[name]?.trim();
  if (!rawValue) {
    return defaultValue;
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function positiveIntegerWithLegacyName(
  env: NodeJS.ProcessEnv,
  name: string,
  legacyName: string,
  defaultValue: number,
): number {
  const selectedName = env[name]?.trim() ? name : legacyName;
  return positiveInteger(env, selectedName, defaultValue);
}

function parseBoolean(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: boolean,
): boolean {
  const rawValue = env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return defaultValue;
  }
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function splitKeywords(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parseFilterSettings(env: NodeJS.ProcessEnv, prefix: string): FilterSettings {
  const enabled = parseBoolean(env, `${prefix}_FILTER_ENABLED`, false);
  const mode = env[`${prefix}_FILTER_MODE`]?.trim().toLowerCase() || "blacklist";
  if (mode !== "blacklist" && mode !== "whitelist") {
    throw new Error(`${prefix}_FILTER_MODE must be blacklist or whitelist`);
  }
  const keywords = splitKeywords(env[`${prefix}_FILTER_KEYWORDS`]);
  if (enabled && keywords.length === 0) {
    throw new Error(`${prefix}_FILTER_KEYWORDS is required when filtering is enabled`);
  }
  return { enabled, mode, keywords };
}

function parseEnabledSources(value: string | undefined): string[] {
  const sourceNames = (value?.trim() || "nodeseek")
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean);
  if (sourceNames.length === 0) {
    throw new Error("ENABLED_SOURCES must include at least one source");
  }
  return [...new Set(sourceNames)];
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeSeekFilter = parseFilterSettings(env, "NODESEEK");
  const sbsbFilter = parseFilterSettings(env, "SBSB");

  return {
    botToken: requiredValue(env, "TELEGRAM_BOT_TOKEN"),
    targetChatId: requiredValue(env, "TELEGRAM_TARGET_CHAT_ID"),
    enabledSources: parseEnabledSources(env.ENABLED_SOURCES),
    pollIntervalMs: positiveIntegerWithLegacyName(env, "POLL_INTERVAL_MS", "NODESEEK_POLL_INTERVAL_MS", 60_000),
    requestTimeoutMs: positiveInteger(env, "REQUEST_TIMEOUT_MS", 15_000),
    globalBlacklistKeywords: splitKeywords(env.GLOBAL_BLACKLIST_KEYWORDS),
    nodeSeekMaxPagesPerPoll: positiveIntegerWithLegacyName(env, "NODESEEK_MAX_PAGES_PER_POLL", "MAX_PAGES_PER_POLL", 100),
    nodeSeekFilterEnabled: nodeSeekFilter.enabled,
    nodeSeekFilterMode: nodeSeekFilter.mode,
    nodeSeekFilterKeywords: nodeSeekFilter.keywords,
    sbsbFilterEnabled: sbsbFilter.enabled,
    sbsbFilterMode: sbsbFilter.mode,
    sbsbFilterKeywords: sbsbFilter.keywords,
    databasePath: env.DATABASE_PATH?.trim() || "./data/state.sqlite",
  };
}

export interface AppConfig {
  botToken: string;
  targetChatId: string;
  enabledSources: string[];
  sourceChannel: string;
  pollIntervalMs: number;
  requestTimeoutMs: number;
  maxPagesPerPoll: number;
  nodeSeekFilterEnabled: boolean;
  nodeSeekFilterMode: "blacklist" | "whitelist";
  nodeSeekFilterKeywords: string[];
  databasePath: string;
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
  const sourceChannel = (
    env.NODESEEK_SOURCE_CHANNEL?.trim()
    || env.TELEGRAM_SOURCE_CHANNEL?.trim()
    || "nodeseekc"
  ).replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(sourceChannel)) {
    throw new Error("NODESEEK_SOURCE_CHANNEL must be a Telegram channel username");
  }

  const nodeSeekFilterEnabled = parseBoolean(env, "NODESEEK_FILTER_ENABLED", false);
  const nodeSeekFilterMode = (env.NODESEEK_FILTER_MODE?.trim().toLowerCase() || "blacklist");
  if (nodeSeekFilterMode !== "blacklist" && nodeSeekFilterMode !== "whitelist") {
    throw new Error("NODESEEK_FILTER_MODE must be blacklist or whitelist");
  }
  const nodeSeekFilterKeywords = (env.NODESEEK_FILTER_KEYWORDS || "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  if (nodeSeekFilterEnabled && nodeSeekFilterKeywords.length === 0) {
    throw new Error("NODESEEK_FILTER_KEYWORDS is required when filtering is enabled");
  }

  return {
    botToken: requiredValue(env, "TELEGRAM_BOT_TOKEN"),
    targetChatId: requiredValue(env, "TELEGRAM_TARGET_CHAT_ID"),
    enabledSources: parseEnabledSources(env.ENABLED_SOURCES),
    sourceChannel,
    pollIntervalMs: positiveIntegerWithLegacyName(env, "NODESEEK_POLL_INTERVAL_MS", "POLL_INTERVAL_MS", 60_000),
    requestTimeoutMs: positiveInteger(env, "REQUEST_TIMEOUT_MS", 15_000),
    maxPagesPerPoll: positiveIntegerWithLegacyName(env, "NODESEEK_MAX_PAGES_PER_POLL", "MAX_PAGES_PER_POLL", 100),
    nodeSeekFilterEnabled,
    nodeSeekFilterMode,
    nodeSeekFilterKeywords,
    databasePath: env.DATABASE_PATH?.trim() || "./data/state.sqlite",
  };
}

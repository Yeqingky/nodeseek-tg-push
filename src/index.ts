import { loadConfig } from "./config.js";
import { formatLogLine } from "./logger.js";
import { ChannelPoller, NODESEEK_SOURCE_CHANNEL } from "./poller.js";
import { SbsbPoller, SBSB_RSS_URL } from "./sbsb-poller.js";
import { StateStore } from "./state-store.js";
import { sendTelegramMessage } from "./telegram.js";

const KNOWN_SOURCES = ["nodeseek", "sbsb"];

interface SourcePoller {
  label: string;
  pollOnce: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const store = new StateStore(config.databasePath);
  const sendTelegram = (message: string) => sendTelegramMessage(
    config.botToken,
    config.targetChatId,
    message,
    config.requestTimeoutMs,
  );

  const enabledSources = new Set(config.enabledSources);
  const pollers: SourcePoller[] = [];
  const sourceDescriptions: string[] = [];

  if (enabledSources.has("nodeseek")) {
    const poller = new ChannelPoller(config, { store, sendTelegram });
    pollers.push({ label: "NodeSeek", pollOnce: () => poller.pollOnce() });
    sourceDescriptions.push(`NodeSeek channel @${NODESEEK_SOURCE_CHANNEL}`);
  }
  if (enabledSources.has("sbsb")) {
    const poller = new SbsbPoller(config, { store, sendTelegram });
    pollers.push({ label: "Sbsb", pollOnce: () => poller.pollOnce() });
    sourceDescriptions.push(`Sbsb RSS ${SBSB_RSS_URL}`);
  }

  const controller = new AbortController();
  const stop = (signal: string) => {
    console.info(formatLogLine("Service", `Received ${signal}; stopping after the current request`));
    controller.abort();
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  const ignoredSources = config.enabledSources.filter((source) => !KNOWN_SOURCES.includes(source));
  console.info(formatLogLine(
    "Service",
    `Enabled sources: ${config.enabledSources.join(", ")}${sourceDescriptions.length > 0 ? `; ${sourceDescriptions.join("; ")}` : ""}`,
  ));
  if (ignoredSources.length > 0) {
    console.info(formatLogLine("Service", `Ignored unknown sources: ${ignoredSources.join(", ")}`));
  }

  try {
    while (!controller.signal.aborted) {
      for (const poller of pollers) {
        if (controller.signal.aborted) {
          break;
        }
        try {
          await poller.pollOnce();
        } catch (error) {
          console.error(formatLogLine(poller.label, `Poll failed: ${errorMessage(error)}`));
        }
      }
      await delay(config.pollIntervalMs, controller.signal);
    }
  } finally {
    store.close();
  }
}

main().catch((error: unknown) => {
  console.error(formatLogLine("Service", `Startup failed: ${errorMessage(error)}`));
  process.exitCode = 1;
});

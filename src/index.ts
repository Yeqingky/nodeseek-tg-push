import { loadConfig } from "./config.js";
import { formatLogLine } from "./logger.js";
import { ChannelPoller } from "./poller.js";
import { StateStore } from "./state-store.js";
import { sendTelegramMessage } from "./telegram.js";

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
  const poller = new ChannelPoller(config, {
    store,
    sendTelegram: (message) => sendTelegramMessage(
      config.botToken,
      config.targetChatId,
      message,
      config.requestTimeoutMs,
    ),
  });
  const controller = new AbortController();
  const stop = (signal: string) => {
    console.info(formatLogLine("Service", `Received ${signal}; stopping after the current request`));
    controller.abort();
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  const nodeSeekEnabled = config.enabledSources.includes("nodeseek");
  console.info(formatLogLine(
    "Service",
    `Enabled sources: ${config.enabledSources.join(", ")}${nodeSeekEnabled ? `; polling @${config.sourceChannel}` : ""}`,
  ));

  try {
    while (!controller.signal.aborted) {
      if (nodeSeekEnabled) {
        try {
          await poller.pollOnce();
        } catch (error) {
          console.error(formatLogLine("NodeSeek", `Poll failed: ${errorMessage(error)}`));
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

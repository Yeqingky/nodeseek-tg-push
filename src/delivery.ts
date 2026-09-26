import { evaluatePostFilter, type PostFilterSettings } from "./filter.js";
import { formatLogLine } from "./logger.js";
import { formatPostMessage } from "./message-format.js";
import type { StateStore } from "./state-store.js";
import type { SourcePost } from "./types.js";

export interface PostDeliveryDependencies {
  store: StateStore;
  sendTelegram: (message: string) => Promise<void>;
  log: (message: string) => void;
}

export interface PostDeliverySettings {
  source: string;
  logName: string;
  includeExcerpt: boolean;
  filter: PostFilterSettings;
}

export async function deliverPost(
  dependencies: PostDeliveryDependencies,
  settings: PostDeliverySettings,
  post: SourcePost,
): Promise<void> {
  const decision = evaluatePostFilter(post.text, settings.filter);
  if (!decision.shouldPush) {
    dependencies.store.setScannedUrl(settings.source, post.url);
    dependencies.log(formatLogLine(`✗ ${settings.logName}`, `${post.url} (${decision.reason})`));
    return;
  }

  await dependencies.sendTelegram(formatPostMessage(post, {
    includeExcerpt: settings.includeExcerpt,
  }));
  dependencies.store.setScannedUrl(settings.source, post.url);
  dependencies.log(formatLogLine(`✓ ${settings.logName}`, post.url));
}

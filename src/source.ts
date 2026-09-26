interface SourceFetchOptions {
  accept: string;
  label: string;
}

export async function fetchSourceText(
  url: string,
  timeoutMs: number,
  options: SourceFetchOptions,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: options.accept,
      "user-agent": "nodeseek-tg-push/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`${options.label} request failed with HTTP ${response.status}`);
  }
  return response.text();
}

export function fetchSourceHtml(url: string, timeoutMs: number): Promise<string> {
  return fetchSourceText(url, timeoutMs, {
    accept: "text/html,application/xhtml+xml",
    label: "Telegram preview",
  });
}

export function fetchSourceXml(url: string, timeoutMs: number): Promise<string> {
  return fetchSourceText(url, timeoutMs, {
    accept: "application/rss+xml, application/xml, text/xml",
    label: "Sbsb RSS feed",
  });
}

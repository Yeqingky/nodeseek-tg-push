export async function fetchSourceHtml(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "nodeseek-tg-push/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Telegram preview request failed with HTTP ${response.status}`);
  }
  return response.text();
}

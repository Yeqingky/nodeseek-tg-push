interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  timeoutMs: number,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let result: TelegramApiResponse;
  try {
    result = await response.json() as TelegramApiResponse;
  } catch {
    throw new Error(`Telegram Bot API returned invalid JSON (HTTP ${response.status})`);
  }

  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram Bot API failed with HTTP ${response.status}`);
  }
}

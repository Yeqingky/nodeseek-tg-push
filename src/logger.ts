export function formatLogLine(source: string, message: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = [
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(" ");
  return `[${timestamp}] ${source}: ${message}`;
}

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class StateStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(resolve(path)), { recursive: true });
    }
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") {
      this.database.prepare("PRAGMA journal_mode = WAL").get();
    }
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS source_checkpoints (
        source TEXT PRIMARY KEY,
        url TEXT NOT NULL
      );
    `);
  }

  getScannedUrl(source: string): string | null {
    const row = this.database.prepare(
      "SELECT url FROM source_checkpoints WHERE source = ?",
    ).get(source) as { url: string } | undefined;
    return row?.url ?? null;
  }

  setScannedUrl(source: string, url: string): void {
    this.database.prepare(`
      INSERT INTO source_checkpoints (source, url)
      VALUES (?, ?)
      ON CONFLICT(source) DO UPDATE SET url = excluded.url
    `).run(source, url);
  }

  close(): void {
    this.database.close();
  }
}

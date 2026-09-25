export interface SourcePost {
  nodeSeekId: number;
  url: string;
  sourceMessageId: number;
  text: string;
  excerpt: string;
  publishedAt: string | null;
}

export interface ParsedTelegramPage {
  posts: SourcePost[];
  messageCount: number;
  nextBefore: number | null;
}

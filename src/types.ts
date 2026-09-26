export interface SourcePost {
  postId: number;
  url: string;
  sourceMessageId: number | null;
  text: string;
  excerpt: string;
  publishedAt: string | null;
}

export interface ParsedTelegramPage {
  posts: SourcePost[];
  messageCount: number;
  nextBefore: number | null;
}

export interface ParsedRssFeed {
  posts: SourcePost[];
  itemCount: number;
}

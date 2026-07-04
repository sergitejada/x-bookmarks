import { DatabaseSync } from "node:sqlite";
import path from "path";

export type MediaItem = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  video_url: string | null;
};

export type Tweet = {
  id: string;
  url: string;
  text: string;
  author_handle: string;
  author_name: string;
  author_avatar: string;
  created_at: string | null;
  likes: number;
  retweets: number;
  media: MediaItem[];
  saved_at: string;
};

const globalForDb = globalThis as unknown as { db?: DatabaseSync };

function createDb() {
  const db = new DatabaseSync(path.join(process.cwd(), "bookmarks.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      author_handle TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      author_avatar TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      likes INTEGER NOT NULL DEFAULT 0,
      retweets INTEGER NOT NULL DEFAULT 0,
      media TEXT NOT NULL DEFAULT '[]',
      raw TEXT,
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tweets_author ON tweets(author_handle);
    CREATE INDEX IF NOT EXISTS idx_tweets_created ON tweets(created_at);
  `);
  return db;
}

export function getDb() {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

type TweetRow = Omit<Tweet, "media" | "likes" | "retweets"> & {
  media: string;
  likes: number | bigint;
  retweets: number | bigint;
};

function rowToTweet(row: TweetRow): Tweet {
  return {
    ...row,
    likes: Number(row.likes),
    retweets: Number(row.retweets),
    media: JSON.parse(row.media) as MediaItem[],
  };
}

export function upsertTweets(tweets: unknown[]): { inserted: number; total: number } {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tweets (id, url, text, author_handle, author_name, author_avatar,
                        created_at, likes, retweets, media, raw)
    VALUES (@id, @url, @text, @author_handle, @author_name, @author_avatar,
            @created_at, @likes, @retweets, @media, @raw)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      likes = excluded.likes,
      retweets = excluded.retweets,
      media = excluded.media,
      raw = excluded.raw
  `);

  const before = (
    db.prepare("SELECT COUNT(*) AS count FROM tweets").get() as { count: number | bigint }
  ).count;

  db.exec("BEGIN");
  try {
    for (const item of tweets) {
      const t = item as Record<string, unknown>;
      if (!t || typeof t.id !== "string" || t.id.length === 0) continue;
      stmt.run({
        id: t.id,
        url: typeof t.url === "string" ? t.url : `https://x.com/i/status/${t.id}`,
        text: typeof t.text === "string" ? t.text : "",
        author_handle: typeof t.author_handle === "string" ? t.author_handle : "",
        author_name: typeof t.author_name === "string" ? t.author_name : "",
        author_avatar: typeof t.author_avatar === "string" ? t.author_avatar : "",
        created_at: typeof t.created_at === "string" ? t.created_at : null,
        likes: typeof t.likes === "number" ? t.likes : 0,
        retweets: typeof t.retweets === "number" ? t.retweets : 0,
        media: JSON.stringify(Array.isArray(t.media) ? t.media : []),
        raw: t.raw ? JSON.stringify(t.raw) : null,
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const after = (
    db.prepare("SELECT COUNT(*) AS count FROM tweets").get() as { count: number | bigint }
  ).count;
  return { inserted: Number(after) - Number(before), total: Number(after) };
}

export function searchTweets(opts: { q?: string; author?: string }): Tweet[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (opts.q) {
    conditions.push("(text LIKE @q OR author_name LIKE @q OR author_handle LIKE @q)");
    params.q = `%${opts.q}%`;
  }
  if (opts.author) {
    conditions.push("author_handle = @author");
    params.author = opts.author;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT id, url, text, author_handle, author_name, author_avatar,
              created_at, likes, retweets, media, saved_at
       FROM tweets ${where}
       ORDER BY created_at DESC
       LIMIT 500`
    )
    .all(params) as unknown as TweetRow[];
  return rows.map(rowToTweet);
}

export function getTopAuthors(limit = 20): { handle: string; name: string; count: number }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT author_handle AS handle, MAX(author_name) AS name, COUNT(*) AS count
       FROM tweets
       WHERE author_handle != ''
       GROUP BY author_handle
       ORDER BY count DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { handle: string; name: string; count: number | bigint }[];
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

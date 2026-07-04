import fs from "node:fs/promises";
import path from "node:path";
import { getDb, type MediaItem } from "./db";

export const MEDIA_DIR = path.join(process.cwd(), "media");

function extFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\.(\w{2,4})$/);
    if (match) return match[1].toLowerCase();
    // pbs.twimg.com usa a veces ?format=jpg en vez de extensión
    const format = u.searchParams.get("format");
    if (format) return format.toLowerCase();
  } catch {
    // URL inválida: usar fallback
  }
  return fallback;
}

/** Descarga url a media/<filename>. Devuelve el filename o null si falla. */
async function download(url: string, filename: string): Promise<string | null> {
  const filePath = path.join(MEDIA_DIR, filename);
  try {
    await fs.access(filePath);
    return filename; // ya descargado
  } catch {
    // no existe: descargar
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(filePath, buf);
    return filename;
  } catch {
    return null;
  }
}

type MediaRow = {
  id: string;
  author_handle: string;
  author_avatar: string;
  author_avatar_local: string | null;
  media: string;
};

/**
 * Descarga la media pendiente de un tweet (fotos, vídeos, avatar) y guarda
 * las rutas locales en la fila. Idempotente: lo ya descargado se salta.
 */
export async function ensureTweetMedia(tweetId: string): Promise<boolean> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, author_handle, author_avatar, author_avatar_local, media
       FROM tweets WHERE id = ?`
    )
    .get(tweetId) as MediaRow | undefined;
  if (!row) return false;

  let changed = false;

  let avatarLocal = row.author_avatar_local;
  if (!avatarLocal && row.author_avatar) {
    const name = `avatar-${row.author_handle || row.id}.${extFromUrl(row.author_avatar, "jpg")}`;
    const got = await download(row.author_avatar, name);
    if (got) {
      avatarLocal = got;
      changed = true;
    }
  }

  const media = JSON.parse(row.media) as MediaItem[];
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    if (m.url && !m.local) {
      const got = await download(m.url, `${row.id}-${i}.${extFromUrl(m.url, "jpg")}`);
      if (got) {
        m.local = got;
        changed = true;
      }
    }
    if (m.video_url && !m.local_video) {
      const got = await download(m.video_url, `${row.id}-${i}.mp4`);
      if (got) {
        m.local_video = got;
        changed = true;
      }
    }
  }

  if (changed) {
    db.prepare("UPDATE tweets SET media = ?, author_avatar_local = ? WHERE id = ?").run(
      JSON.stringify(media),
      avatarLocal,
      row.id
    );
  }
  return changed;
}

/** Procesa una lista de tweets con concurrencia limitada. */
export async function ensureMediaForTweets(
  ids: string[]
): Promise<{ processed: number; updated: number }> {
  const CONCURRENCY = 4;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((id) => ensureTweetMedia(id).catch(() => false))
    );
    updated += results.filter(Boolean).length;
  }
  return { processed: ids.length, updated };
}

/** Recorre toda la base de datos descargando la media que falte. */
export async function backfillAllMedia() {
  const db = getDb();
  const ids = (db.prepare("SELECT id FROM tweets").all() as { id: string }[]).map((r) =>
    String(r.id)
  );
  return ensureMediaForTweets(ids);
}

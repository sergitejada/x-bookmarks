import type { Tweet } from "@/lib/db";

function localUrl(filename: string | null | undefined, fallback: string | null) {
  return filename ? `/api/media/${filename}` : fallback;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <article className="rounded-2xl border border-[#2f3336] bg-[#16181c] p-4 transition-colors hover:border-[#536471]">
      <div className="flex items-start gap-3">
        {tweet.author_avatar || tweet.author_avatar_local ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={localUrl(tweet.author_avatar_local, tweet.author_avatar)!}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-[#2f3336]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate font-bold">{tweet.author_name}</span>
            <a
              href={`/?author=${tweet.author_handle}`}
              className="truncate text-sm text-[#71767b] hover:underline"
            >
              @{tweet.author_handle}
            </a>
            <span className="text-sm text-[#71767b]">· {formatDate(tweet.created_at)}</span>
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-normal">
            {tweet.text}
          </p>

          {tweet.media.length > 0 && (
            <div
              className={`mt-3 grid gap-1 overflow-hidden rounded-xl ${
                tweet.media.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {tweet.media.map((m, i) =>
                m.video_url || m.local_video ? (
                  <video
                    key={i}
                    src={localUrl(m.local_video, m.video_url)!}
                    poster={localUrl(m.local, m.url) ?? undefined}
                    controls
                    preload="none"
                    className="max-h-96 w-full bg-black object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={localUrl(m.local, m.url)!}
                    alt=""
                    loading="lazy"
                    className="max-h-96 w-full object-cover"
                  />
                )
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-5 text-sm text-[#71767b]">
            <span>♥ {formatCount(tweet.likes)}</span>
            <span>⇄ {formatCount(tweet.retweets)}</span>
            <a
              href={tweet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[#1d9bf0] hover:underline"
            >
              Ver en X ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

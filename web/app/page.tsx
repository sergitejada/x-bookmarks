import { searchTweets, getTopAuthors } from "@/lib/db";
import { TweetCard } from "@/components/tweet-card";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string }>;
}) {
  const { q, author } = await searchParams;
  const tweets = searchTweets({ q, author });
  const authors = getTopAuthors();

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <main className="min-w-0 flex-1">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">X Bookmarks</h1>
          <p className="mt-1 text-sm text-[#71767b]">
            {tweets.length} tweets{author ? ` de @${author}` : ""}
            {q ? ` que contienen “${q}”` : ""}
          </p>
        </header>

        <form className="mb-6 flex gap-2" action="/">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar en tus bookmarks…"
            className="w-full rounded-full border border-[#2f3336] bg-[#16181c] px-5 py-2.5 text-[15px] outline-none placeholder:text-[#71767b] focus:border-[#1d9bf0]"
          />
          {author && <input type="hidden" name="author" value={author} />}
          <button
            type="submit"
            className="shrink-0 rounded-full bg-[#1d9bf0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a8cd8]"
          >
            Buscar
          </button>
        </form>

        {(q || author) && (
          <a href="/" className="mb-4 inline-block text-sm text-[#1d9bf0] hover:underline">
            ← Quitar filtros
          </a>
        )}

        {tweets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2f3336] p-12 text-center text-[#71767b]">
            <p className="font-semibold text-[#e7e9ea]">Aún no hay bookmarks</p>
            <p className="mt-2 text-sm leading-relaxed">
              Instala la extensión de Chrome, abre{" "}
              <span className="text-[#1d9bf0]">x.com/i/bookmarks</span> y haz scroll.
              Los tweets aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>
        )}
      </main>

      {authors.length > 0 && (
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-8 rounded-2xl border border-[#2f3336] bg-[#16181c] p-4">
            <h2 className="mb-3 text-sm font-bold text-[#71767b]">Autores más guardados</h2>
            <ul className="flex flex-col gap-1">
              {authors.map((a) => (
                <li key={a.handle}>
                  <a
                    href={`/?author=${a.handle}`}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[#1d1f23] ${
                      author === a.handle ? "text-[#1d9bf0]" : ""
                    }`}
                  >
                    <span className="truncate">@{a.handle}</span>
                    <span className="ml-2 shrink-0 text-xs text-[#71767b]">{a.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

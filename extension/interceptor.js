// Se ejecuta en el mundo MAIN de la página: parchea fetch/XHR para capturar
// las respuestas del endpoint GraphQL "Bookmarks" de X y las normaliza.

(() => {
  const BOOKMARKS_RE = /\/i\/api\/graphql\/[^/]+\/Bookmarks/;

  function parseTweetResult(result) {
    if (!result) return null;
    if (result.__typename === 'TweetWithVisibilityResults') result = result.tweet;
    if (!result || !result.legacy) return null;

    const legacy = result.legacy;
    const userResult = result.core?.user_results?.result;
    const userLegacy = userResult?.legacy ?? {};
    const userCore = userResult?.core ?? {};

    const handle = userCore.screen_name || userLegacy.screen_name || '';
    const name = userCore.name || userLegacy.name || '';
    const avatar =
      userResult?.avatar?.image_url || userLegacy.profile_image_url_https || '';

    // note_tweet contiene el texto completo de tweets largos
    const text =
      result.note_tweet?.note_tweet_results?.result?.text || legacy.full_text || '';

    const rawMedia = legacy.extended_entities?.media || legacy.entities?.media || [];
    const media = rawMedia.map((m) => {
      let videoUrl = null;
      if (m.video_info?.variants) {
        const mp4s = m.video_info.variants
          .filter((v) => v.content_type === 'video/mp4')
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        videoUrl = mp4s[0]?.url || null;
      }
      return { type: m.type, url: m.media_url_https, video_url: videoUrl };
    });

    const id = legacy.id_str || result.rest_id;
    if (!id) return null;

    return {
      id,
      url: `https://x.com/${handle || 'i'}/status/${id}`,
      text,
      author_handle: handle,
      author_name: name,
      author_avatar: avatar,
      created_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : null,
      likes: legacy.favorite_count ?? 0,
      retweets: legacy.retweet_count ?? 0,
      media,
      raw: result,
    };
  }

  function extractTweets(json) {
    const tweets = [];
    const instructions =
      json?.data?.bookmark_timeline_v2?.timeline?.instructions || [];
    for (const instruction of instructions) {
      for (const entry of instruction.entries || []) {
        const content = entry.content;
        if (!content) continue;
        const items =
          content.entryType === 'TimelineTimelineModule'
            ? (content.items || []).map((i) => i.item)
            : [content];
        for (const item of items) {
          const result = item?.itemContent?.tweet_results?.result;
          const tweet = parseTweetResult(result);
          if (tweet) tweets.push(tweet);
        }
      }
    }
    return tweets;
  }

  function handleResponseText(url, text) {
    try {
      const json = JSON.parse(text);
      const tweets = extractTweets(json);
      if (tweets.length > 0) {
        window.postMessage(
          { source: 'x-bookmarks-exporter', type: 'BOOKMARKS_TWEETS', tweets },
          window.location.origin
        );
      }
    } catch {
      // respuesta no-JSON o estructura inesperada: ignorar
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (BOOKMARKS_RE.test(url)) {
        response
          .clone()
          .text()
          .then((text) => handleResponseText(url, text))
          .catch(() => {});
      }
    } catch {
      // nunca romper el fetch de la página
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string' && BOOKMARKS_RE.test(url)) {
      this.addEventListener('load', function () {
        handleResponseText(url, this.responseText);
      });
    }
    return originalOpen.call(this, method, url, ...rest);
  };
})();

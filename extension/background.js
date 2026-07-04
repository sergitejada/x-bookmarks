// Service worker: acumula tweets en chrome.storage.local (dedupe por id)
// y los envía a la app Next local.

const SERVER_URL = 'http://localhost:3005/api/ingest';

async function getStoredTweets() {
  const { tweets } = await chrome.storage.local.get({ tweets: {} });
  return tweets;
}

async function updateBadge(count) {
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0' });
}

async function sendToServer(tweets) {
  const list = Object.values(tweets);
  if (list.length === 0) return { ok: true, sent: 0 };
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweets: list }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    await chrome.storage.local.set({
      lastSync: { at: Date.now(), sent: list.length, result: json },
    });
    return { ok: true, sent: list.length };
  } catch (err) {
    await chrome.storage.local.set({
      lastSync: { at: Date.now(), error: String(err) },
    });
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'BOOKMARKS_TWEETS') {
      const stored = await getStoredTweets();
      let added = 0;
      for (const tweet of message.tweets) {
        if (!stored[tweet.id]) added++;
        stored[tweet.id] = tweet;
      }
      await chrome.storage.local.set({ tweets: stored });
      await updateBadge(Object.keys(stored).length);
      // Envío automático best-effort; si el servidor está apagado no pasa nada,
      // los tweets quedan en storage y se pueden reenviar desde el popup.
      if (added > 0) sendToServer(stored);
      sendResponse({ ok: true, total: Object.keys(stored).length });
    } else if (message.type === 'SEND_TO_SERVER') {
      const stored = await getStoredTweets();
      sendResponse(await sendToServer(stored));
    } else if (message.type === 'GET_STATE') {
      const stored = await getStoredTweets();
      const { lastSync } = await chrome.storage.local.get('lastSync');
      sendResponse({ count: Object.keys(stored).length, lastSync });
    } else if (message.type === 'EXPORT_JSON') {
      const stored = await getStoredTweets();
      sendResponse({ tweets: Object.values(stored) });
    } else if (message.type === 'CLEAR') {
      await chrome.storage.local.set({ tweets: {} });
      await updateBadge(0);
      sendResponse({ ok: true });
    }
  })();
  return true; // respuesta asíncrona
});

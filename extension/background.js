// Service worker: acumula tweets en chrome.storage.local (dedupe por id),
// lleva registro de cuáles están ya sincronizados con el servidor y muestra
// en el badge el número de pendientes.

const SERVER_URL = 'http://localhost:3005/api/ingest';

async function getState() {
  const { tweets, syncedIds } = await chrome.storage.local.get({
    tweets: {},
    syncedIds: {},
  });
  return { tweets, syncedIds };
}

function pendingOf(tweets, syncedIds) {
  return Object.values(tweets).filter((t) => !syncedIds[t.id]);
}

async function updateBadge(pendingCount) {
  await chrome.action.setBadgeText({
    text: pendingCount > 0 ? String(pendingCount) : '',
  });
  await chrome.action.setBadgeBackgroundColor({ color: '#1d9bf0' });
}

// Envía al servidor solo los tweets pendientes; si el POST responde OK,
// los marca como sincronizados y actualiza el badge.
async function syncPending() {
  const { tweets, syncedIds } = await getState();
  const pending = pendingOf(tweets, syncedIds);
  if (pending.length === 0) {
    await updateBadge(0);
    return { ok: true, sent: 0 };
  }
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweets: pending }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();

    // Releer el estado: pueden haber llegado tweets nuevos durante el POST.
    const fresh = await getState();
    for (const tweet of pending) fresh.syncedIds[tweet.id] = true;
    await chrome.storage.local.set({
      syncedIds: fresh.syncedIds,
      lastSync: { at: Date.now(), sent: pending.length },
    });
    await updateBadge(pendingOf(fresh.tweets, fresh.syncedIds).length);
    return { ok: true, sent: pending.length };
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
      const { tweets, syncedIds } = await getState();
      for (const tweet of message.tweets) tweets[tweet.id] = tweet;
      await chrome.storage.local.set({ tweets });
      const pending = pendingOf(tweets, syncedIds);
      await updateBadge(pending.length);
      // Sincronización automática best-effort; si el servidor está apagado,
      // los tweets quedan como pendientes y se reintenta en el siguiente lote.
      if (pending.length > 0) syncPending();
      sendResponse({ ok: true, pending: pending.length });
    } else if (message.type === 'SEND_TO_SERVER') {
      sendResponse(await syncPending());
    } else if (message.type === 'GET_STATE') {
      const { tweets, syncedIds } = await getState();
      const { lastSync } = await chrome.storage.local.get('lastSync');
      sendResponse({
        total: Object.keys(tweets).length,
        pending: pendingOf(tweets, syncedIds).length,
        lastSync,
      });
    } else if (message.type === 'EXPORT_JSON') {
      const { tweets } = await getState();
      sendResponse({ tweets: Object.values(tweets) });
    } else if (message.type === 'CLEAR') {
      await chrome.storage.local.set({ tweets: {}, syncedIds: {} });
      await updateBadge(0);
      sendResponse({ ok: true });
    }
  })();
  return true; // respuesta asíncrona
});

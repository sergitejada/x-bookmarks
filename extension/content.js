// Content script aislado: puente entre la página (interceptor.js) y el
// service worker de la extensión.

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data?.source !== 'x-bookmarks-exporter' || data.type !== 'BOOKMARKS_TWEETS') return;
  chrome.runtime.sendMessage({ type: 'BOOKMARKS_TWEETS', tweets: data.tweets });
});

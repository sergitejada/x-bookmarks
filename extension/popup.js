const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  countEl.textContent = state.count;
  if (state.lastSync?.error) {
    setStatus('Último envío falló: ¿está el servidor en :3005?');
  } else if (state.lastSync?.at) {
    setStatus(`Último envío: ${new Date(state.lastSync.at).toLocaleTimeString()}`);
  }
}

document.getElementById('send').addEventListener('click', async () => {
  setStatus('Enviando…');
  const result = await chrome.runtime.sendMessage({ type: 'SEND_TO_SERVER' });
  setStatus(result.ok ? `Enviados ${result.sent} tweets ✓` : `Error: ${result.error}`);
});

document.getElementById('export').addEventListener('click', async () => {
  const { tweets } = await chrome.runtime.sendMessage({ type: 'EXPORT_JSON' });
  const blob = new Blob([JSON.stringify(tweets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `x-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR' });
  await refresh();
  setStatus('Vaciado.');
});

refresh();

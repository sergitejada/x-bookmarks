# X Bookmarks

Exporta tus bookmarks de X/Twitter y visualízalos en una app local con búsqueda y filtros.

```
x-bookmarks/
├── extension/   # Extensión Chrome MV3: captura los bookmarks desde x.com
└── web/         # App Next.js 15 + SQLite (node:sqlite): guarda y visualiza
```

## Cómo funciona

1. La extensión intercepta (en `interceptor.js`, mundo MAIN) las respuestas del
   endpoint GraphQL interno `Bookmarks` de X mientras haces scroll en
   `x.com/i/bookmarks`.
2. Normaliza cada tweet (texto completo incluidos tweets largos, autor, media,
   métricas) y lo acumula en `chrome.storage.local` con dedupe por id.
3. Lo envía automáticamente por POST a `http://localhost:3005/api/ingest`
   (la app Next). Si el servidor está apagado, no se pierde nada: queda en la
   extensión y puedes reenviarlo o descargar un JSON desde el popup.
4. La app guarda todo en `web/bookmarks.db` (SQLite nativo de Node 24, sin
   dependencias nativas) incluyendo el JSON crudo del tweet, y ofrece búsqueda
   de texto, filtro por autor y ranking de autores más guardados.

## Uso

### 1. Arrancar la app web

```bash
cd web
pnpm install
pnpm dev        # http://localhost:3005
```

### 2. Instalar la extensión

1. Chrome → `chrome://extensions`
2. Activa **Modo de desarrollador** (arriba a la derecha)
3. **Cargar descomprimida** → selecciona la carpeta `extension/`

### 3. Capturar tus bookmarks

1. Abre `https://x.com/i/bookmarks` (recarga la página si ya la tenías abierta,
   la extensión necesita interceptar desde el inicio)
2. Haz scroll hasta el final de tus bookmarks — el badge de la extensión va
   mostrando el contador
3. Abre `http://localhost:3005` y ahí están, buscables

## Notas

- Los tweets se guardan **completos** (texto, media, JSON crudo), no solo la
  URL — si el tweet se borra o la cuenta desaparece, tu copia sobrevive.
- Las imágenes, vídeos y avatares se **descargan a `web/media/`** en segundo
  plano al ingerir cada lote, y la UI los sirve desde `/api/media/<fichero>`
  (con fallback al CDN si alguna descarga falló). Para forzar la descarga de
  lo que falte: `curl -X POST http://localhost:3005/api/media/backfill`.
- El endpoint GraphQL interno de X cambia de vez en cuando; si deja de
  capturar, revisa la estructura en `extension/interceptor.js`
  (`extractTweets`).
- Export a Obsidian: la tabla `tweets` tiene todo lo necesario; generar `.md`
  por tweet es un script corto sobre `bookmarks.db`.

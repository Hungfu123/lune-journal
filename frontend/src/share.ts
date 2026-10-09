/**
 * Fotos abholen, die über das Android-Teilen-Menü hereingekommen sind.
 *
 * Der Service Worker nimmt den POST auf `/share` entgegen und legt die Dateien
 * im Cache ab (siehe `sw.ts`) — durch eine URL passen sie nicht. Hier werden sie
 * genau einmal abgeholt und danach gelöscht, damit sie beim nächsten Öffnen der
 * App nicht noch einmal auftauchen.
 */
const CACHE = 'geteilt'

export interface SharedContent {
  files: File[]
  text: string
}

export async function takeSharedContent(): Promise<SharedContent> {
  const files: File[] = []
  let text = ''
  if (!('caches' in window)) return { files, text }

  try {
    const cache = await caches.open(CACHE)
    for (const request of await cache.keys()) {
      const res = await cache.match(request)
      if (!res) continue
      if (new URL(request.url).pathname.endsWith('/text')) {
        text = await res.text()
        continue
      }
      const blob = await res.blob()
      const name = decodeURIComponent(res.headers.get('X-Dateiname') ?? 'foto.jpg')
      // Als File statt Blob, damit Name und Aufnahmedatum (EXIF) erhalten bleiben
      files.push(new File([blob], name, { type: blob.type || 'image/jpeg' }))
    }
    await caches.delete(CACHE)
  } catch {
    /* Kein Cache erreichbar: dann eben ohne geteilte Fotos */
  }
  return { files, text }
}

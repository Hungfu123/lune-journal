/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Ohne das übernimmt eine neue Fassung erst beim übernächsten Start. Fürs
// Teilen-Menü muss der Service Worker aber zuständig sein, sonst landet der
// POST auf /share beim Server statt hier.
self.skipWaiting()
clientsClaim()

// Fotos ändern sich nie (neuer Name pro Upload): einmal laden, danach sofort aus dem Handy-Speicher.
// Funktioniert auch offline, z. B. beim Durchblättern in der Bahn.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/media/') && !url.searchParams.has('sig'),
  new CacheFirst({
    cacheName: 'photos',
    plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 120 * 24 * 3600, purgeOnQuotaError: true })],
  }),
)

// ---------- Teilen-Ziel ----------
// Android schickt geteilte Fotos als POST an /share. Die Antwort muss eine
// Weiterleitung sein, damit die App danach normal aufgeht; die Dateien selbst
// parken wir solange im Cache, weil sie nicht in eine URL passen.
const SHARE_CACHE = 'geteilt'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share') return

  event.respondWith(
    (async () => {
      let count = 0
      try {
        const form = await event.request.formData()
        const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.type.startsWith('image/'))
        const cache = await caches.open(SHARE_CACHE)
        await Promise.all(
          files.map((f, i) =>
            cache.put(
              `/__geteilt/${i}`,
              new Response(f, {
                headers: {
                  'Content-Type': f.type || 'image/jpeg',
                  // Dateiname überlebt den Cache nicht von allein
                  'X-Dateiname': encodeURIComponent(f.name || `foto-${i}.jpg`),
                },
              }),
            ),
          ),
        )
        const text = [form.get('title'), form.get('text')]
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .join(' ')
        if (text) await cache.put('/__geteilt/text', new Response(text))
        count = files.length
      } catch {
        /* Nichts verwertbares dabei — die App geht trotzdem auf */
      }
      return Response.redirect(new URL(`/?share=${count}`, self.location.origin).href, 303)
    })(),
  )
})

interface PushData {
  title: string
  body?: string
  image?: string | null
  url?: string
  entry_id?: number
  tag?: string
}

self.addEventListener('push', (event) => {
  const d: PushData = event.data?.json() ?? { title: 'Lune Journal' }
  const options: NotificationOptions & { image?: string; vibrate?: number[]; actions?: { action: string; title: string }[] } = {
    body: d.body,
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: d.tag,
    data: d,
    vibrate: [60, 40, 60],
    actions: d.entry_id
      ? [
          { action: 'heart', title: 'Herz senden' },
          { action: 'open', title: 'Ansehen' },
        ]
      : [],
  }
  if (d.image) options.image = d.image
  event.waitUntil(self.registration.showNotification(d.title, options))
})

self.addEventListener('notificationclick', (event) => {
  const d = (event.notification.data ?? {}) as PushData
  event.notification.close()

  // Herz direkt aus der Benachrichtigung, ohne die App zu öffnen
  if (event.action === 'heart' && d.entry_id) {
    event.waitUntil(fetch(`/api/entries/${d.entry_id}/heart?only_add=true`, { method: 'POST', credentials: 'include' }))
    return
  }

  const url = d.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        await (w as WindowClient).navigate(url)
        return (w as WindowClient).focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})

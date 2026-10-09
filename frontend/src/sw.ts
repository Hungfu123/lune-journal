/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Fotos ändern sich nie (neuer Name pro Upload): einmal laden, danach sofort aus dem Handy-Speicher.
// Funktioniert auch offline, z. B. beim Durchblättern in der Bahn.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/media/') && !url.searchParams.has('sig'),
  new CacheFirst({
    cacheName: 'photos',
    plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 120 * 24 * 3600, purgeOnQuotaError: true })],
  }),
)

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

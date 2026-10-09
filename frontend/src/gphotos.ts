import { api } from './api'
import type { Photo } from './types'

// Google Fotos Picker: Auswahl passiert in Google Fotos selbst (dort euer gemeinsames Album öffnen),
// die App bekommt danach genau die ausgewählten Fotos.
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'


let cached: { token: string; until: number } | null = null

export function hasGooglePhotosToken() {
  return !!cached && cached.until > Date.now()
}

/** Holt (falls nötig) die Erlaubnis für Google Fotos. Muss aus einem Klick heraus aufgerufen werden. */
export function connectGooglePhotos(): Promise<string> {
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.token)
  return new Promise((resolve, reject) => {
    const oauth = window.google?.accounts.oauth2
    if (!oauth) return reject(new Error('Google ist gerade nicht erreichbar. Lade die Seite neu.'))
    oauth
      .initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: (r) => {
          if (!r.access_token) return reject(new Error('Ohne Erlaubnis kann die App nicht auf Google Fotos zugreifen.'))
          cached = { token: r.access_token, until: Date.now() + ((r.expires_in ?? 3600) - 120) * 1000 }
          resolve(r.access_token)
        },
      })
      .requestAccessToken()
  })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Öffnet die Auswahl in Google Fotos und liefert die übernommenen Fotos.
 * Das Fenster wird sofort beim Klick geöffnet, sonst blockiert der Browser es.
 */
export async function pickFromGooglePhotos(onStatus: (s: string) => void): Promise<Photo[]> {
  const token = cached?.token
  if (!token) throw new Error('Erst mit Google Fotos verbinden.')
  const wide = window.matchMedia('(min-width: 960px)').matches
  const win = window.open('', 'google-fotos', wide ? 'width=1100,height=820' : undefined)
  try {
    const s = await api.post<{ id: string; pickerUri: string; pollSeconds: number }>('/api/gphotos/session', { token })
    if (win) win.location.href = `${s.pickerUri}/autoclose`
    else window.open(`${s.pickerUri}/autoclose`, '_blank')
    onStatus('Wähl in Google Fotos euer Album und tippe die Fotos an.')
    const started = Date.now()
    while (Date.now() - started < 15 * 60 * 1000) {
      await wait(s.pollSeconds * 1000)
      const { done } = await api.post<{ done: boolean }>(`/api/gphotos/session/${s.id}/status`, { token })
      if (done) {
        onStatus('Fotos werden übernommen …')
        return await api.post<Photo[]>(`/api/gphotos/session/${s.id}/import`, { token })
      }
      if (win && win.closed && Date.now() - started > 4000) {
        // Fenster geschlossen ohne Auswahl: noch einmal nachsehen, dann aufgeben
        const last = await api.post<{ done: boolean }>(`/api/gphotos/session/${s.id}/status`, { token })
        if (!last.done) return []
      }
    }
    return []
  } catch (e) {
    win?.close()
    throw e
  }
}

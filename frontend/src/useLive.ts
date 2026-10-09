import { useEffect, useRef } from 'react'

export type LiveEvent = { kind: 'entry' | 'heart' | 'question'; by: number | null }

/**
 * Hört auf Änderungen der anderen Person und ruft `onChange`, damit die Seite
 * nachlädt — ohne dass jemand aktualisieren muss.
 *
 * Zwei Wege, weil keiner allein reicht: der Server-Kanal (SSE) meldet sich
 * sofort, überlebt aber nicht, wenn das Handy den Tab schlafen legt. Deshalb
 * wird zusätzlich nachgeladen, sobald der Tab wieder sichtbar ist.
 */
export function useLive(onChange: (e: LiveEvent) => void) {
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    // EventSource verbindet sich nach einem Abbruch von selbst neu
    const es = new EventSource('/api/stream')
    es.onmessage = (e) => {
      try {
        cb.current(JSON.parse(e.data) as LiveEvent)
      } catch {
        /* kaputte Zeile überspringen */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') cb.current({ kind: 'entry', by: null })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      es.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

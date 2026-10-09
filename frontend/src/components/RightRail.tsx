import { useEffect, useState } from 'react'
import { api } from '../api'
import { shortDate } from '../dates'
import type { Entry, Me, Photo } from '../types'

interface Props {
  me: Me
  entries: Entry[]
  onJump: (entry: Entry) => void
  onOpenPhotos: (photos: Photo[], index: number, caption: string) => void
}

/** Breiter Desktop: Erinnerung, Monat in Zahlen und Fotowand. Platz, den das Handy nicht hat. */
export default function RightRail({ me, entries, onJump, onOpenPhotos }: Props) {
  const [memory, setMemory] = useState<{ label: string; entry: Entry } | null>(null)
  useEffect(() => {
    api.get<{ label: string; entry: Entry } | null>('/api/memory').then(setMemory).catch(() => setMemory(null))
  }, [])

  const mine = entries.filter((e) => e.mine).length
  const theirs = entries.length - mine
  const max = Math.max(1, mine, theirs)
  const photos = entries.flatMap((e) => e.photos)
  const hearts = entries.reduce((n, e) => n + e.hearts, 0)

  return (
    <aside className="rail" aria-label="Rückblick">
      {memory && (
        <button type="button" className="rail-card memory" onClick={() => onJump(memory.entry)}>
          <span className="rail-label">{memory.label}</span>
          {memory.entry.photos[0] && <img src={memory.entry.photos[0].src} alt="" loading="lazy" />}
          <span className={`memory-text ${memory.entry.mine ? 'is-me' : 'is-her'}`}>{memory.entry.title || memory.entry.text}</span>
          <span className="memory-meta">{memory.entry.author.name}, {shortDate(memory.entry.date)}</span>
        </button>
      )}

      <section className="rail-card">
        <span className="rail-label">Dieser Monat</span>
        <div className="bars">
          <div className="bar-row">
            <span>{me.name}</span>
            <i className="bar is-me-bg" style={{ transform: `scaleX(${mine / max})` }} />
            <b>{mine}</b>
          </div>
          {me.partner && (
            <div className="bar-row">
              <span>{me.partner.name}</span>
              <i className="bar is-her-bg" style={{ transform: `scaleX(${theirs / max})` }} />
              <b>{theirs}</b>
            </div>
          )}
        </div>
        <p className="rail-stats"><b>{photos.length}</b> Fotos <b>{hearts}</b> Herzen</p>
      </section>

      {photos.length > 0 && (
        <section className="rail-card">
          <span className="rail-label">Fotowand</span>
          <div className="wall">
            {photos.slice(0, 9).map((p, i) => (
              <button key={p.id} type="button" className="photo-btn" aria-label={`Foto ${i + 1} ansehen`} onClick={() => onOpenPhotos(photos, i, 'Dieser Monat')}>
                <img src={p.thumb} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}

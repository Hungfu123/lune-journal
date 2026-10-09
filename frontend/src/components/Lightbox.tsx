import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { dayLabel, photoMoment } from '../dates'
import type { Entry, Photo } from '../types'
import Comments from './Comments'
import { Arrow, Close, Pin, Speech } from './Icons'

/**
 * Fotos groß ansehen. Pfeiltasten wechseln ohne Animation (Tastatur), Klick-Pfeile ebenso: schnell, ruhig.
 * Liegt ein Eintrag dazu vor, lassen sich Aufnahmedaten und Kommentare aufklappen.
 */
export default function Lightbox({
  photos,
  start,
  caption,
  entry,
  onClose,
}: {
  photos: Photo[]
  start: number
  caption?: string
  entry?: Entry
  onClose: () => void
}) {
  const [i, setI] = useState(start)
  const [infoOpen, setInfoOpen] = useState(false)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return infoOpen ? setInfoOpen(false) : onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(photos.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [photos.length, onClose, infoOpen])

  const p = photos[i]
  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label="Foto ansehen" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="bv-icon lb-close" aria-label="Schließen" onClick={onClose}><Close /></button>
      {i > 0 && <button type="button" className="bv-icon lb-prev" aria-label="Vorheriges Foto" onClick={() => setI(i - 1)}><Arrow dir="left" /></button>}
      <img key={p.id} className="lb-img" src={p.src} alt="" />
      {i < photos.length - 1 && <button type="button" className="bv-icon lb-next" aria-label="Nächstes Foto" onClick={() => setI(i + 1)}><Arrow dir="right" /></button>}

      <p className="lb-caption">
        {[caption, p.place_name].filter(Boolean).join(', ')}
        {photos.length > 1 && <span> {i + 1} / {photos.length}</span>}
      </p>

      {entry && (
        <button type="button" className="lb-info-btn" aria-expanded={infoOpen} onClick={() => setInfoOpen((v) => !v)}>
          <Speech />
          {infoOpen ? 'Zuklappen' : `Details${entry.comments > 0 ? ` · ${entry.comments}` : ''}`}
        </button>
      )}

      {entry && infoOpen && (
        <div className="lb-info" onClick={(e) => e.stopPropagation()}>
          <h3>Zum Foto</h3>
          <dl className="lb-meta">
            <div>
              <dt>Aufgenommen</dt>
              <dd>{p.taken_at ? photoMoment(p.taken_at, p.tz_offset) : 'Steht nicht in den Bilddaten'}</dd>
            </div>
            {p.place_name && (
              <div>
                <dt>Ort</dt>
                <dd><Pin /> {p.place_name}</dd>
              </div>
            )}
            <div>
              <dt>Größe</dt>
              <dd>{p.width} × {p.height} Punkte</dd>
            </div>
            <div>
              <dt>Eintrag</dt>
              <dd>{entry.author.name}, {dayLabel(entry.date)}</dd>
            </div>
          </dl>
          <h3>Kommentare</h3>
          <Comments entryId={entry.id} />
        </div>
      )}
    </div>,
    document.body,
  )
}

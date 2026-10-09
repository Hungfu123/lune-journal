import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Photo } from '../types'
import { Arrow, Close } from './Icons'

/** Fotos groß ansehen. Pfeiltasten wechseln ohne Animation (Tastatur), Klick-Pfeile ebenso: schnell, ruhig. */
export default function Lightbox({ photos, start, caption, onClose }: { photos: Photo[]; start: number; caption?: string; onClose: () => void }) {
  const [i, setI] = useState(start)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(photos.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [photos.length, onClose])

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
    </div>,
    document.body,
  )
}

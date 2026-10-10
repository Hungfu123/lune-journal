import { useEffect, useRef } from 'react'
import { MAX } from '../limits'
import { createPortal } from 'react-dom'
import type { Composer } from '../useComposer'

/**
 * Ablenkungsfreies Schreiben. Esc geht zurück, der Text bleibt.
 *
 * `imPortal`: normalerweise hängt die Fläche an `document.body`. Aus einem
 * offenen Sheet heraus geht das nicht — dessen Überlagerung ist modal und
 * schluckt alle Tipps. Dort wird die Fläche stattdessen innerhalb des Sheets
 * gerendert.
 */
export default function FocusWriter({ c, onClose, imPortal = true }: { c: Composer; onClose: () => void; imPortal?: boolean }) {
  const text = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = text.current
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length) // weiterschreiben, wo man war
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        c.post().then((ok) => ok && onClose())
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [c, onClose])

  useEffect(() => {
    const el = text.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, window.innerHeight * 0.5)}px`
  }, [c.text])

  const words = c.text.trim() ? c.text.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.round(words / 200))

  const flaeche = (
    <div className={`focus${imPortal ? '' : ' focus-im-sheet'}`} role="dialog" aria-modal="true" aria-label="Fokus-Modus">
      <div className="focus-bar">
        <button type="button" className="link-btn" onClick={onClose}>Fertig <kbd>Esc</kbd></button>
        <span className="focus-count">
          {words} {words === 1 ? 'Wort' : 'Wörter'}
          {words > 40 && <span className="focus-lesezeit">, ca. {minutes} Min. Lesezeit</span>}
        </span>
        <button type="button" className="btn-primary btn-small" disabled={!c.canPost} onClick={() => c.post().then((ok) => ok && onClose())}>
          Posten
        </button>
      </div>
      <div className="focus-page">
        <input className="focus-title" value={c.title} onChange={(e) => c.setTitle(e.target.value)} placeholder="Titel" aria-label="Titel" />
        <textarea ref={text} className="focus-text" maxLength={MAX.text} value={c.text} onChange={(e) => c.setText(e.target.value)} placeholder="Was ist heute passiert?" aria-label="Text" />
      </div>
    </div>
  )
  return imPortal ? createPortal(flaeche, document.body) : flaeche
}

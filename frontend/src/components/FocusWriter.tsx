import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Composer } from '../useComposer'

/** Ablenkungsfreies Schreiben am großen Bildschirm. Esc geht zurück, der Text bleibt. */
export default function FocusWriter({ c, onClose }: { c: Composer; onClose: () => void }) {
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

  return createPortal(
    <div className="focus" role="dialog" aria-modal="true" aria-label="Fokus-Modus">
      <div className="focus-bar">
        <button type="button" className="link-btn" onClick={onClose}>Fertig <kbd>Esc</kbd></button>
        <span className="focus-count">{words} {words === 1 ? 'Wort' : 'Wörter'}{words > 40 && `, ca. ${minutes} Min. Lesezeit`}</span>
        <button type="button" className="btn-primary btn-small" disabled={!c.canPost} onClick={() => c.post().then((ok) => ok && onClose())}>
          Posten
        </button>
      </div>
      <div className="focus-page">
        <input className="focus-title" value={c.title} onChange={(e) => c.setTitle(e.target.value)} placeholder="Titel" aria-label="Titel" />
        <textarea ref={text} className="focus-text" value={c.text} onChange={(e) => c.setText(e.target.value)} placeholder="Was ist heute passiert?" aria-label="Text" />
      </div>
    </div>,
    document.body,
  )
}

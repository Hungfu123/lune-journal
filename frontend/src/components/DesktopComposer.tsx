import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MAX } from '../limits'
import { createPortal } from 'react-dom'
import type { SharedContent } from '../share'
import { useComposer } from '../useComposer'
import type { Entry, Me } from '../types'
import { DateSuggestion, EnergyPicker, MoodPicker, PhotoButtons, PhotoStrip, PlacePicker } from './ComposerParts'
import FocusWriter from './FocusWriter'
import { Expand } from './Icons'
import Segmented from './Segmented'

export interface ComposerHandle {
  focus: () => void
  /** Über das Teilen-Menü hereingereichte Fotos in den Schreibtisch legen */
  addShared: (shared: SharedContent) => void
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

/** Desktop: Schreibtisch direkt über der Timeline. Tippen, Fotos reinziehen oder einfügen, ⌘/Strg + Enter. */
const DesktopComposer = forwardRef<ComposerHandle, { me: Me; onPosted: (e: Entry) => void }>(function DesktopComposer({ me, onPosted }, ref) {
  const [open, setOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [dragging, setDragging] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const c = useComposer((e) => {
    setOpen(false)
    area.current?.blur()
    onPosted(e)
  }, me.auto_location)

  useImperativeHandle(ref, () => ({
    focus: () => {
      setOpen(true)
      area.current?.scrollIntoView({ block: 'center' })
      area.current?.focus()
    },
    addShared: (shared: SharedContent) => {
      setOpen(true)
      if (shared.files.length) void c.addFiles(shared.files)
      if (shared.text && !c.text.trim()) c.setText(shared.text)
      area.current?.scrollIntoView({ block: 'center' })
      area.current?.focus()
    },
  }))

  // Textfeld wächst mit
  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [c.text, c.kind, open])

  // Fotos irgendwo ins Fenster ziehen
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true) } }
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false) } }
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      setOpen(true)
      c.addFiles(e.dataTransfer!.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [c])

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      c.post()
    }
    if (e.key === 'Escape' && c.isEmpty) {
      setOpen(false)
      ;(e.target as HTMLElement).blur()
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (files.length) {
      e.preventDefault()
      c.addFiles(files)
    }
  }

  const words = c.text.trim() ? c.text.trim().split(/\s+/).length : 0

  return (
    <section className={`desk is-${c.kind}`} data-open={open || !c.isEmpty || undefined} onKeyDown={onKey} onPaste={onPaste}>
      <div className="desk-head">
        <span className="avatar is-me-bg" aria-hidden="true">{me.name.charAt(0)}</span>
        {c.kind === 'long' && (open || !c.isEmpty) ? (
          <input className="desk-title" maxLength={MAX.titel} value={c.title} onChange={(e) => c.setTitle(e.target.value)} placeholder="Titel für deinen Tag" />
        ) : (
          <span className="desk-greeting">{open || !c.isEmpty ? 'Neuer Eintrag' : `Was war heute, ${me.name}?`}</span>
        )}
        {(open || !c.isEmpty) && (
          <button type="button" className="icon-btn" title="Fokus-Modus zum Schreiben" aria-label="Fokus-Modus" onClick={() => { c.setKind('long'); setFocusMode(true) }}>
            <Expand />
          </button>
        )}
      </div>

      <textarea
        ref={area}
        className="desk-text"
        maxLength={MAX.text}
        rows={1}
        value={c.text}
        onFocus={() => setOpen(true)}
        onChange={(e) => c.setText(e.target.value)}
        placeholder={c.kind === 'long' ? 'Erzähl von deinem Tag …' : 'Ein Satz zu heute … oder einfach Fotos reinziehen'}
        aria-label="Text des Eintrags"
      />

      <div className="desk-more">
        <div className="desk-more-inner">
          <PhotoStrip c={c} reorder />
          <div className="desk-tools">
            <Segmented
              label="Art des Eintrags"
              value={c.kind}
              onChange={c.setKind}
              options={[{ value: 'short', label: 'Kurz' }, { value: 'long', label: 'Tag erzählen' }]}
            />
            <DateSuggestion c={c} />
            <MoodPicker c={c} />
            <EnergyPicker c={c} />
            <PlacePicker c={c} immer={me.ask_place} />
          </div>
          <PhotoButtons c={c} camera={false} />
          <div className="desk-foot">
            <span className="desk-hint">
              {words > 0 && <>{words} {words === 1 ? 'Wort' : 'Wörter'} · </>}
              <kbd>{isMac ? '⌘' : 'Strg'}</kbd> <kbd>Enter</kbd> zum Posten
            </span>
            {c.isEmpty && (
              <button type="button" className="link-btn" onClick={() => setOpen(false)}>Schließen</button>
            )}
            <button type="button" className="btn-primary btn-small" disabled={!c.canPost} onClick={c.post}>
              {c.posting ? 'Postet …' : 'Posten'}
            </button>
          </div>
        </div>
      </div>

      {dragging &&
        createPortal(
          <div className="drop-overlay" aria-hidden="true">
            <div className="drop-box">
              <strong>Fotos loslassen</strong>
              <span>Sie landen in deinem Eintrag, Datum und Ort kommen aus den Fotos.</span>
            </div>
          </div>,
          document.body,
        )}
      {focusMode && <FocusWriter c={c} onClose={() => setFocusMode(false)} />}
    </section>
  )
})

export default DesktopComposer

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { prefersReducedMotion, useIsDesktop } from '../useMedia'
import { Close } from './Icons'

interface Props {
  pages: string[]
  aspect: number // Breite / Höhe einer Seite
  onClose: () => void
  onShare?: () => void
  onSave: () => void
}

type Dir = 'fwd' | 'back'
interface Flip {
  dir: Dir
  p: number // Fortschritt 0..1
  animating: boolean
  target?: 0 | 1
}

const FLIP_MS = 600
const FLIP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)' // iOS-artige Kurve aus Emils Skill: schnell los, weich aus

/** Blättern wie in einem echten Buch: Handy eine Seite, Desktop Doppelseite. */
export default function BookViewer({ pages, aspect, onClose, onShare, onSave }: Props) {
  const desktop = useIsDesktop()
  // Desktop: Cover allein rechts, danach immer Doppelseiten
  const spreads: [number | null, number | null][] = desktop
    ? [[null, 0], ...Array.from({ length: Math.ceil((pages.length - 1) / 2) }, (_, k) => [1 + 2 * k, 2 + 2 * k < pages.length ? 2 + 2 * k : null] as [number, number | null])]
    : pages.map((_, i) => [null, i] as [null, number])
  const [pos, setPos] = useState(0)
  const [flip, setFlip] = useState<Flip | null>(null)
  const [rubber, setRubber] = useState(0)
  const drag = useRef<{ x: number; t: number; w: number; dir: Dir | null } | null>(null)
  const last = spreads.length - 1

  useEffect(() => setPos((p) => Math.min(p, last)), [last])

  // Tastatur: sofort wechseln, ohne Animation (Emil: Tastaturaktionen nie animieren)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setPos((p) => Math.min(last, p + 1))
      if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [last, onClose])

  const commit = useCallback(() => {
    setFlip((f) => {
      if (!f || !f.animating) return f
      if (f.target === 1) setPos((p) => (f.dir === 'fwd' ? p + 1 : p - 1))
      return null
    })
  }, [])

  const safety = useRef<number>()
  const settle = (f: Flip) => {
    setFlip(f)
    window.clearTimeout(safety.current)
    safety.current = window.setTimeout(commit, FLIP_MS + 80)
  }

  const animateTo = (dir: Dir, from: number, target: 0 | 1) => {
    if (prefersReducedMotion()) {
      if (target === 1) setPos((p) => (dir === 'fwd' ? p + 1 : p - 1))
      setFlip(null)
      return
    }
    setFlip({ dir, p: from, animating: false })
    // Erst den Startwinkel malen, dann zum Ziel übergehen
    requestAnimationFrame(() => requestAnimationFrame(() => settle({ dir, p: target, animating: true, target })))
  }

  const tapFlip = (dir: Dir) => {
    if (flip) return
    if ((dir === 'fwd' && pos >= last) || (dir === 'back' && pos <= 0)) return
    animateTo(dir, 0, 1)
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || flip?.animating) return // Mehrfinger-Schutz
    e.currentTarget.setPointerCapture(e.pointerId)
    const w = (e.currentTarget.querySelector('.bv-page') as HTMLElement | null)?.offsetWidth ?? 300
    drag.current = { x: e.clientX, t: Date.now(), w, dir: null }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.dir && Math.abs(dx) > 6) d.dir = dx < 0 ? 'fwd' : 'back'
    if (!d.dir) return
    const blocked = (d.dir === 'fwd' && pos >= last) || (d.dir === 'back' && pos <= 0)
    if (blocked) {
      // Am Anfang/Ende: Widerstand statt harter Wand
      setRubber(Math.sign(dx) * Math.pow(Math.abs(dx), 0.6))
      return
    }
    const p = Math.min(1, Math.max(0, (d.dir === 'fwd' ? -dx : dx) / (d.w * (desktop ? 1 : 0.9))))
    setFlip({ dir: d.dir, p, animating: false })
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    setRubber(0)
    const dx = e.clientX - d.x
    if (!d.dir) {
      // Tippen: rechte Hälfte vor, linke zurück
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      tapFlip(e.clientX > r.left + r.width / 2 ? 'fwd' : 'back')
      return
    }
    if (!flip) return
    const v = Math.abs(dx) / Math.max(1, Date.now() - d.t)
    const done = flip.p > 0.35 || v > 0.11 // ein schneller Wisch reicht
    settle({ ...flip, p: done ? 1 : 0, animating: true, target: done ? 1 : 0 })
  }

  // Welche Seiten liegen wo?
  const [curL, curR] = spreads[pos] ?? [null, null]
  const next = spreads[pos + 1] ?? [null, null]
  const prev = spreads[pos - 1] ?? [null, null]
  const fwd = flip?.dir === 'fwd'
  const back = flip?.dir === 'back'
  const p = flip?.p ?? 0
  const transition = flip?.animating ? `transform ${FLIP_MS}ms ${FLIP_EASE}` : 'none'

  const img = (i: number | null) => (i == null ? null : <img src={pages[i]} alt={`Seite ${i + 1}`} draggable={false} />)

  // Unten liegend
  const underLeft = back ? (desktop ? prev[0] : null) : curL
  const underRight = fwd ? next[1] : curR

  // Blatt, das sich dreht
  let leaf: JSX.Element | null = null
  if (fwd) {
    leaf = (
      <div className="bv-leaf bv-leaf-right" style={{ transform: `rotateY(${-180 * p}deg)`, transition }} onTransitionEnd={commit}>
        <div className="bv-face">{img(curR)}<span className="bv-shade" style={{ opacity: p * 0.5 }} /></div>
        {desktop && <div className="bv-face bv-back">{img(next[0])}<span className="bv-shade" style={{ opacity: (1 - p) * 0.4 }} /></div>}
      </div>
    )
  } else if (back) {
    leaf = desktop ? (
      <div className="bv-leaf bv-leaf-left" style={{ transform: `rotateY(${180 * p}deg)`, transition }} onTransitionEnd={commit}>
        <div className="bv-face">{img(curL)}<span className="bv-shade" style={{ opacity: p * 0.5 }} /></div>
        <div className="bv-face bv-back">{img(prev[1])}<span className="bv-shade" style={{ opacity: (1 - p) * 0.4 }} /></div>
      </div>
    ) : (
      <div className="bv-leaf bv-leaf-right" style={{ transform: `rotateY(${-180 * (1 - p)}deg)`, transition }} onTransitionEnd={commit}>
        <div className="bv-face">{img(prev[1])}<span className="bv-shade" style={{ opacity: (1 - p) * 0.5 }} /></div>
      </div>
    )
  }

  const pageNo = desktop
    ? [curL, curR].filter((x) => x != null).map((x) => (x as number) + 1).join('–')
    : String((curR ?? 0) + 1)

  return createPortal(
    <div className="bv" role="dialog" aria-modal="true" aria-label="Buch-Vorschau">
      <div className="bv-bar">
        <button type="button" className="bv-icon" aria-label="Schließen" onClick={onClose}><Close /></button>
        <span className="bv-count">Seite {pageNo} von {pages.length}</span>
        <div className="bv-actions">
          {onShare && <button type="button" className="bv-btn" onClick={onShare}>Teilen</button>}
          <button type="button" className="bv-btn bv-btn-primary" onClick={onSave}>Speichern</button>
        </div>
      </div>

      <div
        className={`bv-stage${desktop ? ' is-spread' : ''}`}
        style={{ ['--aspect' as string]: aspect }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="bv-book" style={{ transform: `translateX(${rubber}px)`, transition: rubber ? 'none' : `transform 400ms ${FLIP_EASE}` }}>
          {desktop && <div className="bv-page bv-left">{img(underLeft)}</div>}
          <div className="bv-page bv-right">{img(underRight)}{(fwd || back) && <span className="bv-shade" style={{ opacity: (fwd ? 1 - p : p) * 0.25 }} />}</div>
          {leaf}
        </div>
      </div>

      <p className="bv-hint">{desktop ? 'Klicken oder Pfeiltasten zum Blättern' : 'Wischen oder tippen zum Blättern'}</p>
      {/* Nachbarseiten vorladen, damit beim Blättern nichts nachlädt */}
      <div hidden>{[pos - 1, pos + 1, pos + 2].flatMap((s) => spreads[s] ?? []).map((i) => (i == null ? null : <img key={i} src={pages[i]} alt="" />))}</div>
    </div>,
    document.body,
  )
}

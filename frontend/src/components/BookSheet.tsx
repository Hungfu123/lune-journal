import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { useSheetDirection } from '../useMedia'
import { monthKey, monthName } from '../dates'
import { THEME_KEYS } from '../fonts'
import type { Me, Theme } from '../types'
import BookViewer from './BookViewer'
import Segmented from './Segmented'

const THEME_NAMES: Record<Theme, string> = {
  sunset: 'Sonnenuntergang', ocean: 'Ozean', night: 'Nacht', zitrone: 'Zitrone', tiefsee: 'Tiefsee', wald: 'Wald',
  lavendel: 'Lavendel', retro: 'Retro', kino: 'Kino', bonbon: 'Bonbon', polaroid: 'Polaroid',
  puder: 'Puder', himmel: 'Himmel', mandel: 'Mandel',
}

type Range = 'year' | 'last12' | 'month' | 'custom'
type State = 'idle' | 'working' | 'done'

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function BookSheet({ open, onOpenChange, me }: { open: boolean; onOpenChange: (o: boolean) => void; me: Me }) {
  const direction = useSheetDirection()
  const now = monthKey()
  const [range, setRange] = useState<Range>('year')
  const [from, setFrom] = useState(shiftMonth(now, -2))
  const [to, setTo] = useState(now)
  const [theme, setTheme] = useState<Theme>(me.theme)
  const [fmt, setFmt] = useState<'a5' | 'a4'>('a5')
  const [quality, setQuality] = useState<'screen' | 'print'>('screen')
  const [bleed, setBleed] = useState(false)
  const [title, setTitle] = useState('Lune Journal')
  const [state, setState] = useState<State>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ pages: string[]; aspect: number; pdf: string; name: string } | null>(null)
  const [viewing, setViewing] = useState(false)

  const [start, end] = useMemo(() => {
    if (range === 'year') return [`${now.slice(0, 4)}-01`, now]
    if (range === 'last12') return [shiftMonth(now, -11), now]
    if (range === 'month') return [now, now]
    return from <= to ? [from, to] : [to, from]
  }, [range, from, to, now])

  const rangeLabel = start === end ? monthName(start, true) : `${monthName(start, start.slice(0, 4) !== end.slice(0, 4))} – ${monthName(end, true)}`

  const create = async () => {
    // Optionen ausblenden, damit das aufgeklappte Buch im Blick ist
    document.querySelector('.book-sheet .sheet-body')?.scrollTo({ top: 0 })
    setState('working')
    setFile(null)
    const qs = new URLSearchParams({ start, end, theme, fmt, quality, bleed: String(quality === 'print' && bleed), title })
    try {
      const res = await fetch(`/api/book/preview?${qs}`, { credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Das Buch ließ sich nicht erstellen. Versuch es gleich nochmal.')
      }
      setPreview(data)
      setState('done')
      setViewing(true)
      onOpenChange(false)
      // PDF schon im Hintergrund holen, damit Teilen sofort klappt
      fetch(data.pdf, { credentials: 'same-origin' })
        .then((r) => r.blob())
        .then((blob) => setFile(new File([blob], data.name, { type: 'application/pdf' })))
        .catch(() => setFile(null))
    } catch (e) {
      setState('idle')
      toast.error((e as Error).message)
    }
  }

  const save = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: title || 'Lune Journal' })
    } catch {
      /* Teilen abgebrochen */
    }
  }
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  return (
    <>
    <Drawer.Root handleOnly closeThreshold={0.4} direction={direction} open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && state !== 'working') setState('idle') }}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-tall book-sheet" aria-describedby={undefined}>
          <Drawer.Handle className="sheet-handle" preventCycle />
          <Drawer.Title className="sheet-title">Euer Buch</Drawer.Title>

          <div className="sheet-body sheet-body-plain">
            <div className="book-stage" aria-hidden="true">
              <div className="book" data-theme={theme} data-state={state}>
                <div className="book-pages">
                  <span className="book-line w80" /><span className="book-line w60" /><span className="book-photo" />
                  <span className="book-line w70" /><span className="book-line w40" />
                  <span className="book-progress"><i /></span>
                </div>
                <div className="book-lid">
                <div className="book-inside" />
                <div className="book-cover">
                  <span className="book-dots"><i /><i /></span>
                  <span className="book-names">{me.name}{me.partner ? ` & ${me.partner.name}` : ''}</span>
                  <span className="book-title">{title || 'Lune Journal'}</span>
                  <span className="book-range">{rangeLabel}</span>
                </div>
                </div>
              </div>
            </div>
            <p className="book-status" aria-live="polite">
              {state === 'working' ? 'Das Buch wird gesetzt. Bei vielen Fotos dauert das bis zu einer Minute.' : state === 'done' ? 'Fertig gebunden' : `${fmt.toUpperCase()}, ${quality === 'print' ? 'zum Drucken' : 'zum Anschauen'}`}
            </p>

            {state === 'working' ? null : state === 'done' ? (
              <div className="book-actions">
                <button type="button" className="btn-primary" onClick={() => { setViewing(true); onOpenChange(false) }}>Durchblättern</button>
                {canShare && <button type="button" className="btn-secondary" onClick={share}>Teilen</button>}
                <button type="button" className="btn-secondary" onClick={save} disabled={!file}>{file ? 'Speichern' : 'PDF wird geladen …'}</button>
                <button type="button" className="link-btn" onClick={() => setState('idle')}>Anpassen</button>
              </div>
            ) : (
              <>
                <div className="field">
                  <span>Zeitraum</span>
                  <Segmented
                    label="Zeitraum"
                    value={range}
                    onChange={setRange}
                    options={[{ value: 'year', label: 'Dieses Jahr' }, { value: 'last12', label: '12 Monate' }, { value: 'custom', label: 'Eigener' }]}
                  />
                  {range === 'custom' && (
                    <div className="reminder-row">
                      <label className="field"><span>Von</span><input type="month" value={from} max={now} onChange={(e) => setFrom(e.target.value)} /></label>
                      <label className="field"><span>Bis</span><input type="month" value={to} max={now} onChange={(e) => setTo(e.target.value)} /></label>
                    </div>
                  )}
                </div>

                <label className="field">
                  <span>Titel</span>
                  <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
                </label>

                <div className="field">
                  <span>Design</span>
                  <div className="book-themes">
                    {THEME_KEYS.map((k) => (
                      <button key={k} type="button" className="book-theme" data-theme={k} aria-pressed={theme === k} onClick={() => setTheme(k)}>
                        <span className="theme-swatch" aria-hidden="true"><i /><i /></span>
                        {THEME_NAMES[k]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span>Format</span>
                  <Segmented label="Format" value={fmt} onChange={setFmt} options={[{ value: 'a5', label: 'A5' }, { value: 'a4', label: 'A4' }]} />
                </div>
                <div className="field">
                  <span>Wofür</span>
                  <Segmented
                    label="Qualität"
                    value={quality}
                    onChange={setQuality}
                    options={[{ value: 'screen', label: 'Zum Anschauen' }, { value: 'print', label: 'Zum Drucken' }]}
                  />
                </div>
                {quality === 'print' && (
                  <label className="switch-row">
                    <span>
                      <strong>Mit Beschnitt</strong>
                      <small>3 mm Rand für Druckereien, damit Fotos bis zur Kante gehen.</small>
                    </span>
                    <input type="checkbox" className="switch" checked={bleed} onChange={(e) => setBleed(e.target.checked)} />
                  </label>
                )}

                <button type="button" className="btn-primary" onClick={create}>Buch erstellen</button>
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
    {viewing && preview && (
      <BookViewer
        pages={preview.pages}
        aspect={preview.aspect}
        onClose={() => {
          setViewing(false)
          onOpenChange(true)
        }}
        onSave={save}
        onShare={canShare ? share : undefined}
      />
    )}
    </>
  )
}

import { useEffect, useRef } from 'react'
import { Drawer } from 'vaul'
import type { SharedContent } from '../share'
import { useComposer } from '../useComposer'
import { useSheetDirection } from '../useMedia'
import type { Entry } from '../types'
import { DateSuggestion, EnergyPicker, MoodPicker, PhotoButtons, PhotoStrip, PlacePicker } from './ComposerParts'
import Segmented from './Segmented'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPosted: (e: Entry) => void
  /** Über das Teilen-Menü hereingereichte Fotos */
  shared?: SharedContent | null
  /** Einstellung „immer nach dem Ort fragen" */
  askPlace?: boolean
  /** Einstellung „Standort automatisch mitgeben" */
  autoLocation?: boolean
}

/** Handy: neuer Eintrag als Sheet von unten. */
export default function NewEntrySheet({ open, onOpenChange, onPosted, shared, askPlace = false, autoLocation = false }: Props) {
  const direction = useSheetDirection()
  const c = useComposer((e) => {
    onOpenChange(false)
    onPosted(e)
  }, autoLocation && open)

  // Geteilte Fotos genau einmal übernehmen, nicht bei jedem Rendern
  const übernommen = useRef<SharedContent | null>(null)
  useEffect(() => {
    if (!open || !shared || übernommen.current === shared) return
    übernommen.current = shared
    if (shared.files.length) void c.addFiles(shared.files)
    // Mitgeschickten Text nur nehmen, wenn kein Entwurf im Weg ist
    if (shared.text && !c.text.trim()) c.setText(shared.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shared])

  return (
    <Drawer.Root direction={direction} open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-tall" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <div className="sheet-bar">
            <button type="button" className="link-btn" onClick={() => onOpenChange(false)}>Abbrechen</button>
            <Drawer.Title className="sheet-bar-title">Neuer Eintrag</Drawer.Title>
            <button type="button" className="btn-primary btn-small" disabled={!c.canPost} onClick={c.post}>
              {c.posting ? 'Postet …' : 'Posten'}
            </button>
          </div>

          <div className="sheet-body">
            <Segmented
              label="Art des Eintrags"
              value={c.kind}
              onChange={c.setKind}
              options={[{ value: 'short', label: 'Kurz & knapp' }, { value: 'long', label: 'Tag erzählen' }]}
            />
            {c.kind === 'long' && (
              <label className="field">
                <span>Titel</span>
                <input className="input-title" value={c.title} onChange={(e) => c.setTitle(e.target.value)} placeholder="Sonntag am Rhein" />
              </label>
            )}
            <label className="field">
              <span>{c.kind === 'long' ? 'Erzähl von deinem Tag' : 'Ein Satz zu heute'}</span>
              <textarea
                className={c.kind === 'long' ? 'input-long' : 'input-hand'}
                value={c.text}
                onChange={(e) => c.setText(e.target.value)}
                placeholder={c.kind === 'long' ? 'Was ist passiert? Was war schön, was lustig?' : 'Heute war …'}
              />
            </label>
            <div className="field">
              <span>Fotos</span>
              <PhotoStrip c={c} />
              <PhotoButtons c={c} />
            </div>
            <DateSuggestion c={c} />
            <div className="field">
              <span>Wie war dein Tag?</span>
              <MoodPicker c={c} />
            <EnergyPicker c={c} />
            <PlacePicker c={c} immer={askPlace} />
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

import { useEffect, useRef, useState } from 'react'
import { MAX } from '../limits'
import { Drawer } from 'vaul'
import type { SharedContent } from '../share'
import { useComposer } from '../useComposer'
import { useSheetDirection } from '../useMedia'
import type { Entry } from '../types'
import { DateSuggestion, EnergyPicker, MoodPicker, PhotoButtons, PhotoStrip, PlacePicker } from './ComposerParts'
import FocusWriter from './FocusWriter'
import { Expand } from './Icons'
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
  const [fokus, setFokus] = useState(false)
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
    <Drawer.Root handleOnly closeThreshold={0.4} direction={direction} open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-tall" aria-describedby={undefined}>
          <Drawer.Handle className="sheet-handle" preventCycle />
          <div className="sheet-bar">
            <button type="button" className="link-btn" onClick={() => onOpenChange(false)}>Abbrechen</button>
            <Drawer.Title className="sheet-bar-title">Neuer Eintrag</Drawer.Title>
            {/* Posten sitzt unten im Daumenbereich. Oben rechts liegt der
                Fokus-Modus — selten gebraucht, dafür ist die Ecke richtig. */}
            {c.kind === 'long' ? (
              <button type="button" className="icon-btn" aria-label="Ablenkungsfrei schreiben" onClick={() => setFokus(true)}>
                <Expand />
              </button>
            ) : (
              <span className="sheet-bar-platz" aria-hidden="true" />
            )}
          </div>

          <div className="sheet-body sheet-body-eintrag">
            <Segmented
              label="Art des Eintrags"
              value={c.kind}
              onChange={c.setKind}
              options={[{ value: 'short', label: 'Kurz & knapp' }, { value: 'long', label: 'Tag erzählen' }]}
            />
            {c.kind === 'long' && (
              <input
                className="input-title"
                maxLength={MAX.titel}
                value={c.title}
                aria-label="Titel"
                onChange={(e) => c.setTitle(e.target.value)}
                placeholder="Titel für deinen Tag"
              />
            )}
            {/* Ohne eigene Zeile für die Beschriftung: der Platzhalter sagt dasselbe */}
            <textarea
              maxLength={MAX.text}
              className={c.kind === 'long' ? 'input-long' : 'input-hand'}
              value={c.text}
              aria-label={c.kind === 'long' ? 'Erzähl von deinem Tag' : 'Ein Satz zu heute'}
              onChange={(e) => c.setText(e.target.value)}
              placeholder={c.kind === 'long' ? 'Was ist passiert? Was war schön, was lustig?' : 'Heute war …'}
            />
            <PhotoStrip c={c} />
            <PhotoButtons c={c} />
            {/* Tag und Ort teilen sich eine Zeile — beides ist meist ein Tipp */}
            <div className="composer-row">
              <DateSuggestion c={c} />
              <PlacePicker c={c} immer={askPlace} />
            </div>
            <div className="field">
              <span>Wie war dein Tag?</span>
              <MoodPicker c={c} />
            </div>
            <EnergyPicker c={c} />
          </div>

          <div className="sheet-foot">
            <button type="button" className="btn-primary sheet-post" disabled={!c.canPost} onClick={c.post}>
              {c.posting ? 'Postet …' : 'Posten'}
            </button>
          </div>
          {/* Innerhalb des Sheets, sonst schluckt dessen Überlagerung die Tipps */}
          {fokus && <FocusWriter c={c} onClose={() => setFokus(false)} imPortal={false} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

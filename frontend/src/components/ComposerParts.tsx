import { useRef, useState } from 'react'
import { shortDate, todayISO } from '../dates'
import type { Composer } from '../useComposer'
import { Camera, Close, Gallery, GPhotos, Pin } from './Icons'
import { Spinner } from './Loading'

export const MOODS = ['müde', 'okay', 'gut', 'super']

export function PhotoStrip({ c, reorder = false }: { c: Composer; reorder?: boolean }) {
  const dragFrom = useRef<number | null>(null)
  if (!c.uploads.length) return null
  return (
    <div className="upload-row">
      {c.uploads.map((u, i) => (
        <div
          key={u.key}
          className="upload"
          data-status={u.status}
          draggable={reorder}
          onDragStart={() => (dragFrom.current = i)}
          onDragOver={(e) => reorder && e.preventDefault()}
          onDrop={(e) => {
            if (!reorder || dragFrom.current == null) return
            e.preventDefault()
            e.stopPropagation()
            c.move(dragFrom.current, i)
            dragFrom.current = null
          }}
          title={reorder ? 'Ziehen zum Sortieren' : undefined}
        >
          <img src={u.preview} alt="" />
          {u.status === 'uploading' && (
            <div
              className="upload-progress"
              data-fertig={u.progress >= 1 ? 'true' : undefined}
              role="progressbar"
              aria-label="Foto wird hochgeladen"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(u.progress * 100)}
            >
              {/* Breite über transform, damit nur der Compositor arbeitet */}
              <span style={{ transform: `scaleX(${Math.max(0.04, u.progress)})` }} />
            </div>
          )}
          <button type="button" className="upload-remove" aria-label="Foto entfernen" onClick={() => c.remove(u.key)}>
            <Close />
          </button>
        </div>
      ))}
    </div>
  )
}

/** Ort: freiwillig. Wer in den Einstellungen „immer nach dem Ort fragen" anhat,
 *  sieht das Feld direkt, sonst steht nur ein kleiner Link da. */
export function PlacePicker({ c, immer }: { c: Composer; immer: boolean }) {
  const [offen, setOffen] = useState(immer)
  if (!offen && !c.place) {
    return (
      <div className="field">
        <span>Ort</span>
        <button type="button" className="chip-btn place-add" onClick={() => setOffen(true)}>
          <Pin /> Hinzufügen
        </button>
      </div>
    )
  }
  return (
    <label className="field">
      <span>Ort</span>
      <div className="place-row">
        <input
          type="text"
          value={c.place}
          maxLength={120}
          placeholder="Wo wart ihr?"
          onChange={(e) => c.setPlace(e.target.value)}
        />
        <button type="button" className="btn-secondary btn-small" disabled={c.locating} onClick={c.useStandort}>
          {c.locating ? <><Spinner label="Standort wird gesucht" /> Suche …</> : 'Standort'}
        </button>
      </div>
    </label>
  )
}

/** Energie 1–10: zehn Felder, die sich füllen. Antippen setzt den Wert,
 *  nochmal auf denselben Wert nimmt ihn zurück. */
export function EnergyPicker({ c }: { c: Composer }) {
  return (
    <div className="field">
      <span id="energie-label">
        Energie {c.energy ? <b className="energy-value">{c.energy}/10</b> : <i className="energy-hint">freiwillig</i>}
      </span>
      <div className="energy" role="group" aria-labelledby="energie-label">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="energy-cell"
            data-an={c.energy !== null && n <= c.energy ? 'true' : undefined}
            aria-pressed={c.energy === n}
            aria-label={`Energie ${n} von 10`}
            onClick={() => c.setEnergy(c.energy === n ? null : n)}
          />
        ))}
      </div>
      {/* Ohne die Enden rät man, wofür die zehn Felder stehen */}
      <div className="energy-skala" aria-hidden="true"><span>leer</span><span>voll</span></div>
    </div>
  )
}

export function PhotoButtons({ c, camera = true }: { c: Composer; camera?: boolean }) {
  const cam = useRef<HTMLInputElement>(null)
  const gal = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className={`photo-buttons${camera ? ' has-camera' : ''}`}>
        {camera && <button type="button" className="btn-dashed" onClick={() => cam.current?.click()}><Camera /> Kamera</button>}
        <button type="button" className="btn-dashed" onClick={() => gal.current?.click()}><Gallery /> {camera ? 'Galerie' : 'Fotos hinzufügen'}</button>
        <button type="button" className="btn-dashed" disabled={!!c.gStatus} onClick={c.gConnected ? c.pickGoogle : c.connectGoogle}>
          <GPhotos /> Google Fotos
        </button>
      </div>
      {c.gStatus && <p className="g-status" aria-live="polite">{c.gStatus}</p>}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { c.addFiles(e.target.files); e.target.value = '' }} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { c.addFiles(e.target.files); e.target.value = '' }} />
    </>
  )
}

/**
 * Der Tag, unter dem der Eintrag einsortiert wird — in Timeline, Monatsübersicht
 * und auf der Karte. Steht immer sichtbar da, statt nur aufzutauchen, wenn ein
 * Foto zufällig ein Datum mitbringt: sonst weiß man nie, welcher Tag es wird.
 */
export function DateSuggestion({ c }: { c: Composer }) {
  const heute = todayISO()
  const gewaehlt = c.entryDate ?? heute
  return (
    <div className="field">
      <span>Datum</span>
      <div className="date-row">
        <label className="chip-btn date-chip">
          {c.entryDate ? shortDate(c.entryDate) : 'Heute'}
          <input
            type="date"
            max={heute}
            value={gewaehlt}
            aria-label="Tag des Eintrags"
            // Auf heute gesetzt heißt: kein eigenes Datum, der Eintrag folgt dem Tag
            onChange={(e) => c.setEntryDate(e.target.value && e.target.value !== heute ? e.target.value : null)}
          />
        </label>
        {c.entryDate && !c.bearbeitet && (
          <button type="button" className="link-btn" onClick={() => c.setEntryDate(null)}>
            Zurück auf heute
          </button>
        )}
      </div>

      {c.showSuggestion && c.suggested && (
        <div className="suggest rise">
          <p>Die Fotos sind vom {shortDate(c.suggested)}. Eintrag für diesen Tag anlegen?</p>
          <div className="suggest-actions">
            <button type="button" className="btn-secondary btn-small" onClick={c.dismissSuggestion}>Nein, heute</button>
            <button type="button" className="btn-primary btn-small" onClick={() => c.setEntryDate(c.suggested)}>Ja</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MoodPicker({ c }: { c: Composer }) {
  return (
    <div className="moods">
      {MOODS.map((m) => (
        <button key={m} type="button" className="mood" aria-pressed={c.mood === m} onClick={() => c.setMood(c.mood === m ? '' : m)}>
          {m}
        </button>
      ))}
    </div>
  )
}

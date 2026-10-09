import { useRef } from 'react'
import { shortDate } from '../dates'
import type { Composer } from '../useComposer'
import { Camera, Close, Gallery, GPhotos } from './Icons'

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

export function PhotoButtons({ c, camera = true }: { c: Composer; camera?: boolean }) {
  const cam = useRef<HTMLInputElement>(null)
  const gal = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className={`photo-buttons${camera ? ' has-camera' : ''}`}>
        {camera && <button type="button" className="btn-dashed" onClick={() => cam.current?.click()}><Camera /> Kamera</button>}
        <button type="button" className="btn-dashed" onClick={() => gal.current?.click()}><Gallery /> {camera ? 'Galerie' : 'Fotos hinzufügen'}</button>
        <button type="button" className="btn-dashed" disabled={!!c.gStatus} onClick={c.gConnected ? c.pickGoogle : c.connectGoogle}>
          <GPhotos /> {c.gConnected ? 'Google Fotos' : 'Google Fotos verbinden'}
        </button>
      </div>
      {c.gStatus && <p className="g-status" aria-live="polite">{c.gStatus}</p>}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { c.addFiles(e.target.files); e.target.value = '' }} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { c.addFiles(e.target.files); e.target.value = '' }} />
    </>
  )
}

export function DateSuggestion({ c }: { c: Composer }) {
  return (
    <>
      {c.showSuggestion && c.suggested && (
        <div className="suggest rise">
          <p>Die Fotos sind vom {shortDate(c.suggested)}. Eintrag für diesen Tag anlegen?</p>
          <div className="suggest-actions">
            <button type="button" className="btn-secondary btn-small" onClick={c.dismissSuggestion}>Nein, heute</button>
            <button type="button" className="btn-primary btn-small" onClick={() => c.setEntryDate(c.suggested)}>Ja</button>
          </div>
        </div>
      )}
      {c.entryDate && (
        <button type="button" className="chip" onClick={() => c.setEntryDate(null)} aria-label="Datum zurücksetzen">
          Eintrag für den {shortDate(c.entryDate)} <Close />
        </button>
      )}
    </>
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

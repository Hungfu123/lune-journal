import { useState } from 'react'
import { Drawer } from 'vaul'
import { useSheetDirection } from '../useMedia'
import { dayLabel } from '../dates'
import type { Entry } from '../types'
import HoldToDelete from './HoldToDelete'
import { Heart, More, Pin } from './Icons'

interface Props {
  entry: Entry
  fresh?: boolean
  highlight?: boolean
  onHeart: (e: Entry) => void
  onDelete: (e: Entry) => void
  onOpenPhoto?: (e: Entry, index: number) => void
}

const markLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add('is-loaded')

function Photos({ photos, onOpen }: { photos: Entry['photos']; onOpen?: (i: number) => void }) {
  if (photos.length === 0) return null
  if (photos.length === 1) {
    const p = photos[0]
    return (
      <button type="button" className="photo-btn" aria-label="Foto groß ansehen" onClick={() => onOpen?.(0)}>
      <img
        className="photo-single"
        src={p.src}
        srcSet={`${p.thumb} 480w, ${p.src} 1600w`}
        sizes="(max-width: 560px) 100vw, 560px"
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={markLoaded}
        style={{ aspectRatio: `${p.width} / ${p.height}` }}
      />
      </button>
    )
  }
  const shown = photos.slice(0, 3)
  const extra = photos.length - shown.length
  return (
    <div className={`collage collage-${shown.length}`}>
      {shown.map((p, i) => (
        <button type="button" key={p.id} className="collage-cell photo-btn" aria-label={`Foto ${i + 1} groß ansehen`} onClick={() => onOpen?.(i)}>
          <img src={p.thumb} srcSet={`${p.thumb} 480w, ${p.src} 1600w`} sizes="50vw" alt="" loading="lazy" decoding="async" onLoad={markLoaded} />
          {extra > 0 && i === shown.length - 1 && <span className="collage-more">+{extra}</span>}
        </button>
      ))}
    </div>
  )
}

export default function EntryCard({ entry, fresh, highlight, onHeart, onDelete, onOpenPhoto }: Props) {
  const direction = useSheetDirection()
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(false)
  const long = entry.kind === 'long'
  const tooLong = long && entry.text.length > 260

  return (
    <article
      id={`entry-${entry.id}`}
      className={`card ${entry.mine ? 'is-me' : 'is-her'}${fresh ? ' rise' : ''}${highlight ? ' highlight' : ''}`}
    >
      <header className="card-head">
        <span className="avatar" aria-hidden="true">{entry.author.name.charAt(0)}</span>
        <div className="card-meta">
          <strong>{entry.author.name}</strong>
          <span>
            {dayLabel(entry.date)}
            {entry.mood && `, fühlt sich ${entry.mood}`}
          </span>
        </div>
        {entry.mine && (
          <button type="button" className="icon-btn" aria-label="Optionen" onClick={() => setMenu(true)}>
            <More />
          </button>
        )}
      </header>

      <Photos photos={entry.photos} onOpen={(i) => onOpenPhoto?.(entry, i)} />

      {long && entry.title && <h3 className="card-title">{entry.title}</h3>}
      {entry.text &&
        (long ? (
          <p className={`card-text${tooLong && !expanded ? ' clamped' : ''}`}>{entry.text}</p>
        ) : (
          <p className="card-hand">{entry.text}</p>
        ))}
      {tooLong && (
        <button type="button" className="link-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Weniger anzeigen' : 'Weiterlesen'}
        </button>
      )}

      {entry.place_name && (
        <p className="card-place">
          <Pin /> {entry.place_name}
        </p>
      )}

      <footer className="card-actions">
        <button
          type="button"
          className="pill"
          aria-pressed={entry.hearted}
          aria-label={entry.hearted ? 'Herz zurücknehmen' : 'Herz geben'}
          onClick={() => onHeart(entry)}
        >
          <Heart filled={entry.hearted} />
          {entry.hearts > 0 ? entry.hearts : 'Herz'}
        </button>
      </footer>

      <Drawer.Root direction={direction} open={menu} onOpenChange={setMenu}>
        <Drawer.Portal>
          <Drawer.Overlay className="sheet-overlay" />
          <Drawer.Content className="sheet sheet-small" aria-describedby={undefined}>
            <div className="sheet-handle" />
            <Drawer.Title className="sheet-title">Eintrag vom {dayLabel(entry.date)}</Drawer.Title>
            <HoldToDelete
              onConfirm={() => {
                setMenu(false)
                onDelete(entry)
              }}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </article>
  )
}

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { api } from '../api'
import { dayLabel, monthKey, monthName } from '../dates'
import { enablePush, shouldAskForPush } from '../push'
import { takeSharedContent, type SharedContent } from '../share'
import { useLive } from '../useLive'
import { useIsDesktop, useMedia } from '../useMedia'
import type { Entry, Me, Photo, Question } from '../types'
import AskSheet from './AskSheet'
import QACard from './QACard'
import QuestionStrip from './QuestionStrip'
import SettingsSheet from './SettingsSheet'
import EntryCard from './EntryCard'
import BookSheet from './BookSheet'
import DesktopComposer, { type ComposerHandle } from './DesktopComposer'
import Lightbox from './Lightbox'
import { FeedSkeleton } from './Loading'
import RightRail from './RightRail'
import { Book, Chevron, MapIcon, Plus } from './Icons'
import MonthGrid from './MonthGrid'
import MonthSheet from './MonthSheet'
import NewEntrySheet from './NewEntrySheet'
import Segmented from './Segmented'

// Leaflet wiegt mehr als die halbe App — erst laden, wenn die Karte aufgeht
const MapSheet = lazy(() => import('./MapSheet'))

type Filter = 'all' | 'me' | 'partner'

export default function Timeline({ me, onMeChange }: { me: Me; onMeChange: (m: Me) => void }) {
  const params = new URLSearchParams(location.search)
  const nowKey = monthKey()
  const [month, setMonth] = useState(params.get('month') ?? nowKey)
  const [filter, setFilter] = useState<Filter>('all')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  // Welche Einträge gerade hereingleiten sollen: eigene frisch gepostete und
  // die, die währenddessen von der anderen Person dazugekommen sind
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(() => new Set())
  const knownIds = useRef<ReadonlySet<number>>(new Set())
  const [highlightId, setHighlightId] = useState<number | null>(Number(params.get('entry')) || null)
  const [newOpen, setNewOpen] = useState(params.get('new') === '1')
  const [openQs, setOpenQs] = useState<Question[]>([])
  const [answered, setAnswered] = useState<Question[]>([])
  const [freshQ, setFreshQ] = useState<number | null>(null)
  const [targetQ, setTargetQ] = useState<number | null>(Number(params.get('q')) || null)
  const [askOpen, setAskOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const shownMonth = useRef(month)
  const viaKeyboard = useRef(false)
  const desktop = useIsDesktop()
  const composer = useRef<ComposerHandle>(null)
  const wide = useMedia('(min-width: 1280px)')
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number; caption: string; entry?: Entry } | null>(null)
  const startWriting = () => (desktop ? composer.current?.focus() : setNewOpen(true))
  const [monthOpen, setMonthOpen] = useState(false)
  const [shared, setShared] = useState<SharedContent | null>(null)
  const partner = me.partner?.name ?? 'Partner'

  /** `markNew`: Einträge, die seit dem letzten Laden dazugekommen sind, gleiten herein. */
  const load = useCallback((markNew = false) => {
    api
      .get<Entry[]>(`/api/entries?month=${month}&author=${filter}`)
      .then((data) => {
        const ids: ReadonlySet<number> = new Set(data.map((e) => e.id))
        if (markNew) {
          const arrived = data.filter((e) => !knownIds.current.has(e.id)).map((e) => e.id)
          if (arrived.length) setFreshIds(new Set(arrived))
        } else if (shownMonth.current !== month) {
          // Zurück in einen Monat: alte Karten sollen nicht erneut hereingleiten
          setFreshIds(new Set())
        }
        knownIds.current = ids
        // Nur beim Monatswechsel überblenden; Filter wechseln oft und bleiben deshalb sofort
        const prev = shownMonth.current
        shownMonth.current = month
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const keyboard = viaKeyboard.current
        viaKeyboard.current = false
        // Tastatur: nie animieren (Emil), sonst kurze Überblendung
        if (prev === month || keyboard || !document.startViewTransition || reduce) return setEntries(data)
        const root = document.documentElement
        root.style.setProperty('--dir', month > prev ? '1' : '-1')
        root.classList.add('vt-feed')
        document.startViewTransition(() => flushSync(() => setEntries(data))).finished.finally(() => root.classList.remove('vt-feed'))
      })
      .catch((e) => toast.error((e as Error).message))
    api.get<Question[]>(`/api/questions?month=${month}`).then(setAnswered).catch(() => setAnswered([]))
  }, [month, filter])

  const loadOpenQuestions = useCallback(() => {
    api.get<Question[]>('/api/questions/open').then(setOpenQs).catch(() => setOpenQs([]))
  }, [])

  useEffect(load, [load])
  useEffect(loadOpenQuestions, [loadOpenQuestions])

  // Schreibt die andere Person etwas, holt die Seite es sich sofort — eigene
  // Änderungen stehen schon im State und würden nur unnötig neu laden.
  useLive((e) => {
    if (e.by === me.id) return
    load(true)
    if (e.kind === 'question') loadOpenQuestions()
  })

  // Aus einer Fragen-Benachrichtigung geöffnet
  useEffect(() => {
    if (!targetQ || !entries) return
    document.getElementById(`q-${targetQ}`)?.scrollIntoView({ block: 'center' })
    history.replaceState(null, '', '/')
    setTargetQ(null)
  }, [targetQ, entries, openQs, answered])

  const questionAnswered = (q: Question) => {
    if (q.complete) {
      setOpenQs((list) => list.filter((x) => x.id !== q.id))
      setAnswered((list) => [q, ...list.filter((x) => x.id !== q.id)])
      setFreshQ(q.id)
      if (month !== nowKey) setMonth(nowKey)
    } else {
      setOpenQs((list) => list.map((x) => (x.id === q.id ? q : x)))
      toast('Antwort gespeichert')
    }
  }

  // Über das Android-Teilen-Menü geöffnet: Fotos abholen und den Eintrag aufmachen
  useEffect(() => {
    if (!params.get('share')) return
    history.replaceState(null, '', '/')
    takeSharedContent().then((content) => {
      if (!content.files.length && !content.text) {
        toast.error('Die geteilten Fotos sind nicht angekommen. Teil sie noch einmal.')
        return
      }
      if (desktop) {
        // Der Schreibtisch hängt am aktuellen Monat
        setMonth(nowKey)
        composer.current?.addShared(content)
      } else {
        setShared(content)
        setNewOpen(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aus einer Benachrichtigung geöffnet: zum Eintrag scrollen
  useEffect(() => {
    if (!highlightId || !entries) return
    document.getElementById(`entry-${highlightId}`)?.scrollIntoView({ block: 'center' })
    history.replaceState(null, '', '/')
    const t = window.setTimeout(() => setHighlightId(null), 1600)
    return () => window.clearTimeout(t)
  }, [highlightId, entries])

  // Tastenkürzel am Desktop: N neuer Eintrag, B Buch, ←/→ Monat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return
      if (document.querySelector('[data-vaul-drawer], .bv, .lb, .focus')) return
      const k = e.key.toLowerCase()
      if (k === 'n') { e.preventDefault(); startWriting() }
      else if (k === 'b') { e.preventDefault(); setBookOpen(true) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const [y, m] = month.split('-').map(Number)
        const d = new Date(y, m - 1 + (e.key === 'ArrowLeft' ? -1 : 1), 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (key <= nowKey) { viaKeyboard.current = true; setMonth(key) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [month, nowKey, desktop])

  const replace = (e: Entry) => setEntries((list) => list?.map((x) => (x.id === e.id ? e : x)) ?? null)

  const heart = (e: Entry) => {
    replace({ ...e, hearted: !e.hearted, hearts: e.hearts + (e.hearted ? -1 : 1) })
    api.post<Entry>(`/api/entries/${e.id}/heart`).then(replace).catch(() => replace(e))
  }

  const remove = (e: Entry) => {
    setEntries((list) => list?.filter((x) => x.id !== e.id) ?? null)
    api
      .del(`/api/entries/${e.id}`)
      .then(() => toast('Eintrag gelöscht'))
      .catch((err) => {
        toast.error((err as Error).message)
        load()
      })
  }

  const posted = (e: Entry) => {
    const key = e.date.slice(0, 7)
    if (key === month && filter !== 'partner') {
      setEntries((list) => [e, ...(list ?? [])].sort((a, b) => b.date.localeCompare(a.date)))
    } else {
      setFilter('all')
      setMonth(key)
    }
    setFreshIds(new Set([e.id]))
    toast('Gepostet')
    if (shouldAskForPush()) {
      toast(`Bescheid bekommen, wenn ${partner} etwas postet?`, {
        duration: 12000,
        action: {
          label: 'Ja, gerne',
          onClick: () =>
            enablePush()
              .then((ok) => toast(ok ? 'Benachrichtigungen sind an' : 'Benachrichtigungen bleiben aus. Du kannst sie in den Android-Einstellungen erlauben.'))
              .catch(() => toast.error('Benachrichtigungen ließen sich nicht einschalten.')),
        },
      })
    }
  }

  type FeedItem = { kind: 'entry'; date: string; at: string; entry: Entry } | { kind: 'qa'; date: string; at: string; q: Question }
  const feed: FeedItem[] = [
    ...(entries ?? []).map((entry) => ({ kind: 'entry' as const, date: entry.date, at: entry.created_at, entry })),
    ...(filter === 'all' ? answered : []).map((q) => ({ kind: 'qa' as const, date: q.completed_at!.slice(0, 10), at: q.completed_at!, q })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))

  const emptyText =
    filter === 'partner' ? `Noch nichts von ${partner} in diesem Monat.` : filter === 'me' ? 'Du hast diesen Monat noch nichts geschrieben.' : 'Hier ist es noch leer. Schreibt euren ersten Tag.'

  return (
    <div className="app">
      <aside className="side">
      <header className="top">
        <div>
          <h1 className="brand">Lune Journal</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-btn" aria-label="Karte mit euren Orten" onClick={() => setMapOpen(true)}>
            <MapIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="Buch erstellen" onClick={() => setBookOpen(true)}>
            <Book />
          </button>
          <button type="button" className="avatars" aria-label="Einstellungen" onClick={() => setSettingsOpen(true)}>
            <span className="avatar is-me-bg">{me.name.charAt(0)}</span>
            {me.partner && <span className="avatar is-her-bg">{me.partner.name.charAt(0)}</span>}
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="controls-row">
          <button type="button" className="month-btn" onClick={() => setMonthOpen(true)}>
            {monthName(month, month !== nowKey)} <Chevron />
          </button>
          {month !== nowKey && (
            <button type="button" className="btn-primary btn-small" onClick={() => setMonth(nowKey)}>Zurück zu heute</button>
          )}
        </div>
        <Segmented
          label="Wessen Einträge"
          value={filter}
          onChange={setFilter}
          activeColor={filter === 'me' ? 'var(--me)' : filter === 'partner' ? 'var(--her)' : undefined}
          activeText={filter === 'me' ? 'var(--me-on)' : filter === 'partner' ? 'var(--her-on)' : undefined}
          options={[{ value: 'all', label: 'Alle' }, { value: 'me', label: 'Meine' }, { value: 'partner', label: partner }]}
        />
      </div>
      {desktop && (
        <>
          <div className="side-desktop">
            <button type="button" className="btn-primary side-new" onClick={startWriting}>
              <Plus /> Neuer Eintrag
            </button>
            <div className="side-cal">
              <MonthGrid current={month} onPick={setMonth} refreshKey={entries?.length} showRandom={false} title={<strong>Monate</strong>} />
            </div>
          </div>
          <p className="kbd-hints">
            <span><kbd>N</kbd> Neuer Eintrag</span>
            <span><kbd>←</kbd> <kbd>→</kbd> Monat</span>
            <span><kbd>B</kbd> Buch</span>
          </p>
        </>
      )}
      </aside>

      <main className="feed">
        {desktop && (
          <div className="feed-heading">
            <h2 className="brand">{monthName(month, month.slice(0, 4) !== nowKey.slice(0, 4))}</h2>
            {month !== nowKey && <button type="button" className="btn-secondary btn-small" onClick={() => setMonth(nowKey)}>Zurück zu heute</button>}
          </div>
        )}
        {desktop && month === nowKey && <DesktopComposer ref={composer} me={me} onPosted={posted} />}
        {month === nowKey && filter === 'all' && me.partner && (
          <QuestionStrip
            me={me}
            questions={openQs}
            onAsk={() => setAskOpen(true)}
            onAnswered={questionAnswered}
            onDeleted={(id) => setOpenQs((list) => list.filter((x) => x.id !== id))}
          />
        )}
        {feed.map((item) =>
          item.kind === 'entry' ? (
            <EntryCard key={`e${item.entry.id}`} entry={item.entry} fresh={freshIds.has(item.entry.id)} highlight={item.entry.id === highlightId} onHeart={heart} onDelete={remove} onOpenPhoto={(entry, index) => setLightbox({ photos: entry.photos, index, caption: `${entry.author.name}, ${dayLabel(entry.date)}`, entry })} />
          ) : (
            <QACard key={`q${item.q.id}`} q={item.q} me={me} fresh={item.q.id === freshQ} />
          ),
        )}
        {entries === null && <FeedSkeleton />}
        {entries && feed.length === 0 && (
          <div className="empty">
            <p>{emptyText}</p>
            {filter !== 'all' ? (
              <button type="button" className="btn-secondary" onClick={() => setFilter('all')}>Alle anzeigen</button>
            ) : (
              <button type="button" className="btn-primary" onClick={startWriting}>Eintrag schreiben</button>
            )}
          </div>
        )}
      </main>

      {wide && (
        <RightRail
          me={me}
          entries={entries ?? []}
          onJump={(e) => {
            setFilter('all')
            setMonth(e.date.slice(0, 7))
            setHighlightId(e.id)
          }}
          onOpenPhotos={(photos, index, caption) => setLightbox({ photos, index, caption })}
        />
      )}

      <button type="button" className="fab" aria-label="Neuer Eintrag" onClick={() => setNewOpen(true)}>
        <Plus />
      </button>

      {mapOpen && (
        <Suspense fallback={null}>
          <MapSheet
            open
            me={me}
            onOpenChange={setMapOpen}
            onPick={(entryId, date) => {
              setMapOpen(false)
              setMonth(date.slice(0, 7))
              setHighlightId(entryId)
            }}
          />
        </Suspense>
      )}
      {!desktop && <NewEntrySheet open={newOpen} onOpenChange={setNewOpen} onPosted={posted} shared={shared} askPlace={me.ask_place} autoLocation={me.auto_location} />}
      {lightbox && (
        <Lightbox photos={lightbox.photos} start={lightbox.index} caption={lightbox.caption} entry={lightbox.entry} onClose={() => setLightbox(null)} />
      )}
      <AskSheet
        open={askOpen}
        onOpenChange={setAskOpen}
        partnerName={me.partner?.name ?? 'Partner'}
        onAsked={(q) => {
          setOpenQs((list) => [q, ...list])
          toast(`Frage an ${me.partner?.name ?? 'Partner'} gestellt`)
        }}
      />
      <BookSheet open={bookOpen} onOpenChange={setBookOpen} me={me} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} me={me} onMeChange={onMeChange} />
      <MonthSheet open={monthOpen} onOpenChange={setMonthOpen} current={month} onPick={setMonth} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import { monthKey } from '../dates'

const SHORT = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

interface Props {
  current: string
  onPick: (key: string) => void
  active?: boolean // nur laden, wenn sichtbar
  refreshKey?: unknown
  title?: React.ReactNode
  showRandom?: boolean
}

export default function MonthGrid({ current, onPick, active = true, refreshKey, title, showRandom = true }: Props) {
  const nowKey = monthKey()
  const [year, setYear] = useState(Number(current.slice(0, 4)))
  const [counts, setCounts] = useState<number[] | null>(null)

  useEffect(() => setYear(Number(current.slice(0, 4))), [current])
  useEffect(() => {
    if (!active) return
    api.get<{ month: number; count: number }[]>(`/api/months?year=${year}`).then((r) => setCounts(r.map((x) => x.count))).catch(() => setCounts(null))
  }, [active, year, refreshKey])

  const random = () => {
    if (!counts) return
    const filled = counts.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0)
    if (filled.length) onPick(`${year}-${String(filled[Math.floor(Math.random() * filled.length)] + 1).padStart(2, '0')}`)
  }

  return (
    <>
      <div className="month-head">
        {title}
        <div className="year-switch">
          <button type="button" className="icon-btn" aria-label="Vorheriges Jahr" onClick={() => setYear((y) => y - 1)}>‹</button>
          <span>{year}</span>
          <button type="button" className="icon-btn" aria-label="Nächstes Jahr" disabled={year >= Number(nowKey.slice(0, 4))} onClick={() => setYear((y) => y + 1)}>›</button>
        </div>
      </div>
      <div className="month-grid">
        {SHORT.map((name, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`
          const future = key > nowKey
          return (
            <button key={key} type="button" className="month-tile" aria-pressed={key === current} disabled={future} onClick={() => onPick(key)}>
              <span className="month-name">{name}</span>
              <span className="month-count">{future ? '' : counts ? `${counts[i]} Einträge` : ' '}</span>
            </button>
          )
        })}
      </div>
      {showRandom && (
        <button type="button" className="btn-secondary" onClick={random} disabled={!counts || counts.every((c) => c === 0)}>
          Zufällige Erinnerung aus {year}
        </button>
      )}
    </>
  )
}

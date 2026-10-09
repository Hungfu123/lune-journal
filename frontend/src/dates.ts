const tz = 'Europe/Berlin'

export function monthKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(d)
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthName(key: string, withYear: boolean): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
}

export function dayLabel(iso: string): string {
  if (iso === todayISO()) return 'Heute'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === isoDate(y)) return 'Gestern'
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function shortDate(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

/** Aufnahmezeitpunkt eines Fotos, in der Zeit des Aufnahmeorts. */
export function photoMoment(takenAt: string, tzOffset: string | null): string {
  // taken_at ist bereits Ortszeit; ohne Z anhängen, sonst rechnet der Browser um
  const d = new Date(takenAt.replace(/Z$/, ''))
  if (Number.isNaN(d.getTime())) return ''
  const datum = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${datum}, ${zeit} Uhr${tzOffset ? ` (UTC${tzOffset})` : ''}`
}

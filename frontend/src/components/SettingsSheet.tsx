import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { useSheetDirection } from '../useMedia'
import { api } from '../api'
import { applyTheme } from '../fonts'
import type { Me, Theme } from '../types'

const THEMES: { value: Theme; name: string }[] = [
  { value: 'sunset', name: 'Sonnen\u00ADuntergang' },
  { value: 'ocean', name: 'Ozean' },
  { value: 'night', name: 'Nacht' },
  { value: 'wald', name: 'Wald' },
  { value: 'lavendel', name: 'Lavendel' },
  { value: 'zitrone', name: 'Zitrone' },
  { value: 'polaroid', name: 'Polaroid' },
  { value: 'kino', name: 'Kino' },
  { value: 'retro', name: 'Retro' },
  { value: 'bonbon', name: 'Bonbon' },
  { value: 'tiefsee', name: 'Tiefsee' },
]
const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  me: Me
  onMeChange: (m: Me) => void
}

export default function SettingsSheet({ open, onOpenChange, me, onMeChange }: Props) {
  const direction = useSheetDirection()
  const update = (patch: Record<string, unknown>) =>
    api.patch<Me>('/api/auth/me', patch).then(onMeChange).catch((e) => toast.error((e as Error).message))

  // Seltene Aktion: Das neue Theme wächst als Kreis vom angetippten Feld aus über den Bildschirm
  const switchTheme = (theme: Theme, el: HTMLElement) => {
    if (theme === me.theme) return
    const apply = () => {
      flushSync(() => onMeChange({ ...me, theme }))
      applyTheme(theme)
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) {
      apply()
    } else {
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      document.startViewTransition(apply).ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 500, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
    }
    api.patch<Me>('/api/auth/me', { theme }).then(onMeChange).catch((e) => toast.error((e as Error).message))
  }

  const logout = async () => {
    await api.post('/api/auth/logout')
    location.reload()
  }

  return (
    <Drawer.Root direction={direction} open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <Drawer.Title className="sheet-title">Einstellungen</Drawer.Title>
          <div className="sheet-body sheet-body-plain">
            <div className="field">
              <span>Dein Design</span>
              <div className="theme-grid">
                {THEMES.map((t) => (
                  <button key={t.value} type="button" className="theme-tile" data-theme={t.value} aria-pressed={me.theme === t.value} onClick={(e) => switchTheme(t.value, e.currentTarget)}>
                    <span className="theme-swatch" aria-hidden="true"><i /><i /></span>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="switch-row">
              <span>
                <strong>Wöchentliche Erinnerung</strong>
                <small>Ein kleiner Anstoß, etwas aufzuschreiben. Fällt aus, wenn du an dem Tag schon geschrieben hast.</small>
              </span>
              <input type="checkbox" className="switch" checked={me.reminder.enabled} onChange={(e) => update({ reminder_enabled: e.target.checked })} />
            </label>
            {me.reminder.enabled && (
              <div className="reminder-row">
                <label className="field">
                  <span>Tag</span>
                  <select value={me.reminder.weekday} onChange={(e) => update({ reminder_weekday: Number(e.target.value) })}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Uhrzeit</span>
                  <select value={me.reminder.hour} onChange={(e) => update({ reminder_hour: Number(e.target.value) })}>
                    {Array.from({ length: 16 }, (_, i) => i + 7).map((h) => <option key={h} value={h}>{h}:00 Uhr</option>)}
                  </select>
                </label>
              </div>
            )}

            <button type="button" className="btn-secondary" onClick={logout}>Abmelden</button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

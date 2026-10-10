import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { api } from '../api'
import { dayLabel } from '../dates'
import { useSheetDirection } from '../useMedia'
import type { MapPoint, Me } from '../types'
import { Spinner } from './Loading'
import Segmented from './Segmented'

/** Punkte, die auf dem Bildschirm dichter als das zusammenliegen, werden zu einem. */
const CLUSTER_PX = 56

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

type Cluster = { lat: number; lon: number; points: MapPoint[] }

/**
 * Karte mit allen Fotos, die Koordinaten mitbringen. Zusammengefasst wird nach
 * Bildschirmabstand, nicht nach Entfernung in Metern: zwei Fotos vom selben
 * Platz sollen ein Punkt sein, egal wie weit man herausgezoomt hat.
 */
type Wer = 'alle' | 'meine' | 'partner'

export default function MapSheet({ open, onOpenChange, onPick, me }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (entryId: number, date: string) => void
  me: Me
}) {
  const direction = useSheetDirection()
  const [points, setPoints] = useState<MapPoint[] | null>(null)
  const [wer, setWer] = useState<Wer>('alle')
  const [jahr, setJahr] = useState('alle')
  const [monat, setMonat] = useState('alle')
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!open) return
    api.get<MapPoint[]>('/api/places').then(setPoints).catch((e) => {
      setPoints([])
      toast.error((e as Error).message)
    })
  }, [open])

  const jahre = [...new Set((points ?? []).map((p) => p.date.slice(0, 4)))].sort().reverse()
  const gezeigt = (points ?? []).filter(
    (p) =>
      (wer === 'alle' || (wer === 'meine') === p.mine) &&
      (jahr === 'alle' || p.date.slice(0, 4) === jahr) &&
      (monat === 'alle' || p.date.slice(5, 7) === monat),
  )

  /** Ausschnitt so wählen, dass alle gezeigten Punkte hineinpassen. */
  const alleZeigen = useCallback(() => {
    const m = map.current
    if (!m || !gezeigt.length) return
    m.fitBounds(L.latLngBounds(gezeigt.map((p) => [p.lat, p.lon] as [number, number])), { padding: [48, 48], maxZoom: 15 })
  }, [gezeigt])

  // Karte aufbauen, sobald das Sheet offen und der Platz bekannt ist
  useEffect(() => {
    if (!open || !box.current || map.current || !points) return
    const m = L.map(box.current, { attributionControl: true, zoomControl: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(m)
    L.control.zoom({ position: 'bottomleft' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m

    if (points.length) {
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [48, 48], maxZoom: 15 })
    } else {
      // Kein Punkt da: irgendein Ausschnitt, der Hinweis darüber erklärt es
      m.setView([51.23, 6.78], 11)
    }
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [open, points])

  // Filter geändert: Ausschnitt nachziehen, damit man die Auswahl auch sieht
  useEffect(() => {
    alleZeigen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wer, jahr, monat])

  // Punkte nach jedem Verschieben neu zusammenfassen
  useEffect(() => {
    const m = map.current
    if (!m || !points) return

    const zeichnen = () => {
      const g = layer.current
      if (!g) return
      g.clearLayers()

      const clusters: Cluster[] = []
      for (const p of gezeigt) {
        const pos = m.latLngToContainerPoint([p.lat, p.lon])
        const nah = clusters.find((c) => m.latLngToContainerPoint([c.lat, c.lon]).distanceTo(pos) < CLUSTER_PX)
        if (nah) nah.points.push(p)
        else clusters.push({ lat: p.lat, lon: p.lon, points: [p] })
      }

      for (const c of clusters) {
        const erstes = c.points[0]
        const mehrere = c.points.length > 1
        const icon = L.divIcon({
          className: '',
          html: mehrere
            ? `<span class="map-cluster">${c.points.length}</span>`
            : erstes.thumb
              ? `<span class="map-pin${erstes.mine ? ' is-me' : ' is-her'}"><img src="${erstes.thumb}" alt=""></span>`
              // Eintrag ohne Foto: nur der Standort wurde mitgegeben
              : `<span class="map-dot${erstes.mine ? ' is-me' : ' is-her'}">${erstes.author.charAt(0)}</span>`,
          iconSize: mehrere ? [38, 38] : [46, 46],
          iconAnchor: mehrere ? [19, 19] : [23, 23],
        })
        L.marker([c.lat, c.lon], { icon, keyboard: true, title: erstes.place_name ?? dayLabel(erstes.date) })
          .on('click', () => {
            if (mehrere) {
              m.setView([c.lat, c.lon], Math.min(m.getZoom() + 2, 18))
              return
            }
            onPick(erstes.entry_id, erstes.date)
          })
          .addTo(g)
      }
    }

    zeichnen()
    m.on('moveend zoomend', zeichnen)
    return () => {
      m.off('moveend zoomend', zeichnen)
    }
  }, [gezeigt, onPick])

  return (
    <Drawer.Root closeThreshold={0.4} direction={direction} open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-tall" aria-describedby={undefined}>
          <Drawer.Handle className="sheet-handle" preventCycle />
          <div className="sheet-bar">
            <button type="button" className="link-btn" onClick={() => onOpenChange(false)}>Schließen</button>
            <Drawer.Title className="sheet-bar-title">Eure Orte</Drawer.Title>
            <span className="map-count">{points ? `${gezeigt.length} von ${points.length}` : ''}</span>
          </div>

          {points && points.length > 0 && (
            <div className="map-filter" data-vaul-no-drag>
              <Segmented
                label="Wessen Orte"
                value={wer}
                onChange={setWer}
                options={[
                  { value: 'alle', label: 'Alle' },
                  { value: 'meine', label: 'Meine' },
                  { value: 'partner', label: me.partner?.name ?? 'Partner' },
                ]}
              />
              <div className="map-filter-row">
                <select aria-label="Jahr" value={jahr} onChange={(e) => setJahr(e.target.value)}>
                  <option value="alle">Alle Jahre</option>
                  {jahre.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <select aria-label="Monat" value={monat} onChange={(e) => setMonat(e.target.value)}>
                  <option value="alle">Alle Monate</option>
                  {MONATE.map((name, i) => (
                    <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary btn-small" disabled={!gezeigt.length} onClick={alleZeigen}>
                  Alle zeigen
                </button>
              </div>
            </div>
          )}

          <div className="map-wrap" data-vaul-no-drag>
            {!points && (
              <p className="map-hint"><Spinner label="Karte lädt" /> Orte werden geladen …</p>
            )}
            {points && points.length === 0 && (
              <p className="map-hint">
                Noch kein Foto mit Ort. Kamera-Fotos bringen ihn meist mit; geteilte oft nicht — dafür gibt es in den
                Einstellungen „Standort automatisch mitgeben".
              </p>
            )}
            {points && points.length > 0 && gezeigt.length === 0 && (
              <p className="map-hint">Zu dieser Auswahl gibt es keine Orte.</p>
            )}
            <div ref={box} className="map" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

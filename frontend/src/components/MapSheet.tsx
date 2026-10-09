import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { api } from '../api'
import { dayLabel } from '../dates'
import { useSheetDirection } from '../useMedia'
import type { MapPoint } from '../types'
import { Spinner } from './Loading'

/** Punkte, die auf dem Bildschirm dichter als das zusammenliegen, werden zu einem. */
const CLUSTER_PX = 56

type Cluster = { lat: number; lon: number; points: MapPoint[] }

/**
 * Karte mit allen Fotos, die Koordinaten mitbringen. Zusammengefasst wird nach
 * Bildschirmabstand, nicht nach Entfernung in Metern: zwei Fotos vom selben
 * Platz sollen ein Punkt sein, egal wie weit man herausgezoomt hat.
 */
export default function MapSheet({ open, onOpenChange, onPick }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (entryId: number, date: string) => void
}) {
  const direction = useSheetDirection()
  const [points, setPoints] = useState<MapPoint[] | null>(null)
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
      m.setView([51.23, 6.78], 11)
    }
    return () => {
      m.remove()
      map.current = null
      layer.current = null
    }
  }, [open, points])

  // Punkte nach jedem Verschieben neu zusammenfassen
  useEffect(() => {
    const m = map.current
    if (!m || !points) return

    const zeichnen = () => {
      const g = layer.current
      if (!g) return
      g.clearLayers()

      const clusters: Cluster[] = []
      for (const p of points) {
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
  }, [points, onPick])

  return (
    <Drawer.Root direction={direction} open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet sheet-tall" aria-describedby={undefined}>
          <div className="sheet-handle" />
          <div className="sheet-bar">
            <button type="button" className="link-btn" onClick={() => onOpenChange(false)}>Schließen</button>
            <Drawer.Title className="sheet-bar-title">Eure Orte</Drawer.Title>
            <span className="map-count">{points ? `${points.length} Fotos` : ''}</span>
          </div>

          <div className="map-wrap">
            {!points && (
              <p className="map-hint"><Spinner label="Karte lädt" /> Orte werden geladen …</p>
            )}
            {points && points.length === 0 && (
              <p className="map-hint">Noch keine Fotos mit Ort. Fotos von der Kamera bringen ihn meist mit.</p>
            )}
            <div ref={box} className="map" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

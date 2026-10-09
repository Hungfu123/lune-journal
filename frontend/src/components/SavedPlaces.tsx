import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import type { SavedPlace } from '../types'
import { Close, Pin } from './Icons'
import { Spinner } from './Loading'

/**
 * Orte mit Spitznamen. Steht ein Eintrag im Umkreis, zeigt die App „Zuhause"
 * statt der Straße von OpenStreetMap. Die Liste gilt für beide.
 */
export default function SavedPlaces() {
  const [list, setList] = useState<SavedPlace[] | null>(null)
  const [name, setName] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<SavedPlace[]>('/api/saved-places').then(setList).catch(() => setList([]))
  }, [])

  const hierBin = () => {
    if (!navigator.geolocation) {
      toast.error('Dieses Gerät gibt den Standort nicht her.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setBusy(false)
      },
      () => {
        setBusy(false)
        toast.error('Der Standort war nicht abrufbar. Erlaub den Zugriff in den Browser-Einstellungen.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const merken = async () => {
    if (!coords || !name.trim()) return
    setBusy(true)
    try {
      setList(await api.post<SavedPlace[]>('/api/saved-places', { ...coords, name }))
      setName('')
      setCoords(null)
      toast('Ort gemerkt')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const löschen = async (id: number) => {
    try {
      setList(await api.del<SavedPlace[]>(`/api/saved-places/${id}`))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="saved-places">
      <p className="saved-places-title">Orte mit Namen</p>
      <p className="saved-places-hint">
        Steht ihr im Umkreis von 150 m, schreibt die App euren Namen statt der Straße.
      </p>

      {list?.map((p) => (
        <div key={p.id} className="saved-place">
          <Pin />
          <strong>{p.name}</strong>
          <button type="button" className="comment-del" aria-label={`${p.name} entfernen`} onClick={() => löschen(p.id)}>
            <Close />
          </button>
        </div>
      ))}
      {list?.length === 0 && <p className="saved-places-hint">Noch keine. Merk dir den ersten, wenn du zu Hause bist.</p>}

      {coords ? (
        <div className="place-row">
          <input
            type="text"
            value={name}
            maxLength={40}
            autoFocus
            placeholder="Zuhause, Arbeit, Lieblingscafé …"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && merken()}
          />
          <button type="button" className="btn-primary btn-small" disabled={!name.trim() || busy} onClick={merken}>
            {busy ? <Spinner label="Wird gespeichert" /> : 'Merken'}
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary btn-small" disabled={busy} onClick={hierBin}>
          {busy ? <><Spinner label="Standort wird gesucht" /> Suche …</> : 'Diesen Ort merken'}
        </button>
      )}
    </div>
  )
}

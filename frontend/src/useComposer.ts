import exifr from 'exifr'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, upload } from './api'
import { isoDate, todayISO } from './dates'
import { connectGooglePhotos, hasGooglePhotosToken, pickFromGooglePhotos } from './gphotos'
import type { Entry, Photo } from './types'

export interface Upload {
  key: string
  preview: string
  takenISO: string | null
  status: 'uploading' | 'done' | 'error'
  /** 0 bis 1, danach rechnet der Server noch an den Bildgrößen */
  progress: number
  photo?: Photo
}

/** Gemeinsame Logik für den Handy-Sheet und den Desktop-Schreibtisch. */
export function useComposer(onPosted: (e: Entry) => void) {
  const [kind, setKind] = useState<'short' | 'long'>('short')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [mood, setMood] = useState('')
  const [energy, setEnergy] = useState<number | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [entryDate, setEntryDate] = useState<string | null>(null)
  const [dismissedDate, setDismissedDate] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [gStatus, setGStatus] = useState<string | null>(null)
  const [gConnected, setGConnected] = useState(hasGooglePhotosToken())

  // Entwurf überlebt das Schließen der App
  useEffect(() => {
    const saved = localStorage.getItem('draft')
    if (saved) {
      const d = JSON.parse(saved)
      setKind(d.kind ?? 'short'); setTitle(d.title ?? ''); setText(d.text ?? ''); setMood(d.mood ?? ''); setEnergy(d.energy ?? null)
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('draft', JSON.stringify({ kind, title, text, mood, energy }))
  }, [kind, title, text, mood, energy])

  const reset = () => {
    uploads.forEach((u) => u.preview.startsWith('blob:') && URL.revokeObjectURL(u.preview))
    setKind('short'); setTitle(''); setText(''); setMood(''); setEnergy(null); setUploads([]); setEntryDate(null); setDismissedDate(null)
  }

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const key = crypto.randomUUID()
      let takenISO: string | null = null
      try {
        const meta = await exifr.parse(file, ['DateTimeOriginal'])
        if (meta?.DateTimeOriginal instanceof Date) takenISO = isoDate(meta.DateTimeOriginal)
      } catch {
        /* keine Metadaten, auch gut */
      }
      setUploads((u) => [...u, { key, preview: URL.createObjectURL(file), takenISO, status: 'uploading', progress: 0 }])
      upload<Photo>('/api/photos', file, (anteil) =>
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: anteil } : x))),
      )
        .then((photo) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'done', progress: 1, photo } : x))))
        .catch((e) => {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'error' } : x)))
          toast.error((e as Error).message)
        })
    }
  }

  const connectGoogle = async () => {
    try {
      await connectGooglePhotos()
      setGConnected(true)
      toast('Mit Google Fotos verbunden')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const pickGoogle = async () => {
    try {
      setGStatus('Google Fotos öffnet sich …')
      const photos = await pickFromGooglePhotos(setGStatus)
      setUploads((u) => [
        ...u,
        ...photos.map((photo) => ({ key: photo.id, preview: photo.thumb, takenISO: photo.taken_at?.slice(0, 10) ?? null, status: 'done' as const, progress: 1, photo })),
      ])
      if (photos.length) toast(`${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'} aus Google Fotos übernommen`)
    } catch (e) {
      toast.error((e as Error).message)
      setGConnected(hasGooglePhotosToken())
    } finally {
      setGStatus(null)
    }
  }

  const remove = (key: string) => setUploads((x) => x.filter((y) => y.key !== key))
  const move = (from: number, to: number) =>
    setUploads((list) => {
      const next = [...list]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      return next
    })

  // Sind alle Fotos vom selben, anderen Tag? Dann diesen Tag vorschlagen.
  const dates = [...new Set(uploads.map((u) => u.takenISO).filter(Boolean))] as string[]
  const suggested = dates.length === 1 && dates[0] < todayISO() ? dates[0] : null
  const showSuggestion = !!suggested && entryDate !== suggested && dismissedDate !== suggested

  const busy = uploads.some((u) => u.status === 'uploading') || !!gStatus
  const ready = uploads.filter((u) => u.status === 'done' && u.photo)
  const canPost = !posting && !busy && (text.trim().length > 0 || ready.length > 0)
  const isEmpty = !text.trim() && !title.trim() && uploads.length === 0

  const post = async () => {
    if (!canPost) return false
    setPosting(true)
    try {
      const entry = await api.post<Entry>('/api/entries', {
        kind,
        title: kind === 'long' ? title : '',
        text,
        mood,
        energy,
        entry_date: entryDate,
        photo_ids: ready.map((u) => u.photo!.id),
      })
      localStorage.removeItem('draft')
      reset()
      onPosted(entry)
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    } finally {
      setPosting(false)
    }
  }

  return {
    kind, setKind, title, setTitle, text, setText, mood, setMood, energy, setEnergy, uploads, addFiles, remove, move,
    entryDate, setEntryDate, suggested, showSuggestion, dismissSuggestion: () => setDismissedDate(suggested),
    posting, canPost, isEmpty, post, gStatus, gConnected, connectGoogle, pickGoogle,
  }
}

export type Composer = ReturnType<typeof useComposer>

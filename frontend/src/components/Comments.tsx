import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { dayLabel } from '../dates'
import type { Comment } from '../types'
import { Close } from './Icons'
import { Skeleton, Spinner } from './Loading'

/**
 * Kommentare unter einem Eintrag. Geladen wird erst beim Aufklappen — die
 * Timeline soll nicht für jeden Eintrag eine Anfrage mehr schicken.
 */
export default function Comments({ entryId, onCount }: { entryId: number; onCount?: (n: number) => void }) {
  const [list, setList] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const feld = useRef<HTMLTextAreaElement>(null)

  // Mitwachsen statt Anfasser am Rand — auf dem Handy zieht daran niemand
  useEffect(() => {
    const el = feld.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const übernehmen = (daten: Comment[]) => {
    setList(daten)
    onCount?.(daten.length)
  }

  useEffect(() => {
    api
      .get<Comment[]>(`/api/entries/${entryId}/comments`)
      .then(übernehmen)
      .catch((e) => {
        setList([])
        toast.error((e as Error).message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  const senden = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      übernehmen(await api.post<Comment[]>(`/api/entries/${entryId}/comments`, { text }))
      setText('')
      feld.current?.focus()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const löschen = async (id: number) => {
    try {
      übernehmen(await api.del<Comment[]>(`/api/comments/${id}`))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="comments">
      {list === null ? (
        <div className="comment is-her" aria-hidden="true">
          <Skeleton w="40%" h={12} />
          <Skeleton w="85%" h={14} />
        </div>
      ) : (
        list.map((c) => (
          <div key={c.id} className={`comment${c.mine ? ' is-me' : ' is-her'}`}>
            <div className="comment-head">
              <strong>{c.author.name}</strong>
              <span>{dayLabel(c.created_at.slice(0, 10))}</span>
              {c.mine && (
                <button type="button" className="comment-del" aria-label="Kommentar löschen" onClick={() => löschen(c.id)}>
                  <Close />
                </button>
              )}
            </div>
            <p>{c.text}</p>
          </div>
        ))
      )}

      <div className="comment-write">
        <textarea
          ref={feld}
          value={text}
          rows={1}
          maxLength={1000}
          placeholder="Etwas dazu schreiben …"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter schickt ab, Umschalt+Enter macht einen Absatz
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void senden()
            }
          }}
        />
        <button type="button" className="btn-primary btn-small" disabled={!text.trim() || busy} onClick={senden}>
          {busy ? <Spinner label="Wird gesendet" /> : 'Senden'}
        </button>
      </div>
    </div>
  )
}

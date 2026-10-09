import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import type { Me, Question } from '../types'

interface Props {
  me: Me
  questions: Question[]
  onAsk: () => void
  onAnswered: (q: Question) => void
  onDeleted: (id: number) => void
}

function OpenForMe({ q, me, onAnswered }: { q: Question; me: Me; onAnswered: (q: Question) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const partner = me.partner?.name ?? 'Partner'
  const asker = q.mine ? 'Deine Frage, ihr antwortet beide' : `Frage von ${q.asker.name}`
  const partnerAnswered = q.both && !q.waiting_on.includes(partner)

  const send = async () => {
    setSending(true)
    try {
      onAnswered(await api.post<Question>(`/api/questions/${q.id}/answer`, { text }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section id={`q-${q.id}`} className={`ask-card ${q.mine ? 'is-me' : 'is-her'}`}>
      <p className="ask-from">{asker}</p>
      <h2 className="ask-text">{q.text}</h2>
      <label className="field">
        <span className="visually-hidden">Deine Antwort</span>
        <textarea className="input-answer" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ein Satz reicht …" />
      </label>
      {q.both && (
        <p className="ask-hint">
          {partnerAnswered ? `${partner} hat schon geantwortet. Du siehst die Antwort, sobald du antwortest.` : 'Ihr seht beide Antworten, sobald ihr beide fertig seid.'}
        </p>
      )}
      <button type="button" className="btn-primary" disabled={sending || !text.trim()} onClick={send}>
        {q.both && partnerAnswered ? 'Antwort aufdecken' : 'Antworten'}
      </button>
    </section>
  )
}

export default function QuestionStrip({ me, questions, onAsk, onAnswered, onDeleted }: Props) {
  const forMe = questions.filter((q) => q.open_for_me)
  const waiting = questions.filter((q) => !q.open_for_me)

  const remove = (q: Question) =>
    api
      .del(`/api/questions/${q.id}`)
      .then(() => onDeleted(q.id))
      .catch((e) => toast.error((e as Error).message))

  return (
    <div className="questions">
      {forMe.map((q) => (
        <OpenForMe key={q.id} q={q} me={me} onAnswered={onAnswered} />
      ))}
      {waiting.map((q) => (
        <div key={q.id} id={`q-${q.id}`} className="waiting">
          <p>
            <strong>Wartet auf {q.waiting_on.join(' und ')}</strong>
            {q.text}
          </p>
          {q.mine && q.answers.length === 0 && (
            <button type="button" className="link-btn" onClick={() => remove(q)}>Zurückziehen</button>
          )}
        </div>
      ))}
      <button type="button" className="ask-btn" onClick={onAsk}>
        Frage an {me.partner?.name ?? 'deinen Partner'} stellen
      </button>
    </div>
  )
}

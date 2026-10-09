import { dayLabel } from '../dates'
import type { Me, Question } from '../types'

export default function QACard({ q, me, fresh }: { q: Question; me: Me; fresh?: boolean }) {
  return (
    <article id={`q-${q.id}`} className={`card qa${fresh ? ' reveal' : ''}`}>
      <p className="qa-meta">
        {q.both ? 'Ihr habt beide geantwortet' : `${q.asker.name} hat gefragt`}, {dayLabel(q.completed_at!.slice(0, 10))}
      </p>
      <h3 className="qa-question">{q.text}</h3>
      <div className="qa-answers">
        {q.answers.map((a) => (
          <div key={a.user.id} className={`qa-answer ${a.user.id === me.id ? 'is-me' : 'is-her'}`}>
            <span>{a.user.name}</span>
            <p>{a.text}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

import { useState } from 'react'
import { toast } from 'sonner'
import { Drawer } from 'vaul'
import { useSheetDirection } from '../useMedia'
import { api } from '../api'
import type { Question } from '../types'

interface Idea {
  text: string
  category: string
  label: string
  both: boolean
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  partnerName: string
  onAsked: (q: Question) => void
}

export default function AskSheet({ open, onOpenChange, partnerName, onAsked }: Props) {
  const direction = useSheetDirection()
  const [text, setText] = useState('')
  const [both, setBoth] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [sending, setSending] = useState(false)

  const loadIdeas = () => api.get<Idea[]>('/api/questions/ideas').then(setIdeas)

  const send = async () => {
    setSending(true)
    try {
      const q = await api.post<Question>('/api/questions', { text, both })
      setText(''); setBoth(false); setIdeas([])
      onOpenChange(false)
      onAsked(q)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer.Root handleOnly closeThreshold={0.4} direction={direction} open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <Drawer.Handle className="sheet-handle" preventCycle />
          <Drawer.Title className="sheet-title">Frage an {partnerName}</Drawer.Title>
          <div className="sheet-body sheet-body-plain">
            <label className="field">
              <span>Deine Frage</span>
              <textarea className="input-question" value={text} onChange={(e) => setText(e.target.value)} placeholder="Was wolltest du schon immer wissen?" />
            </label>

            <div className="ideas">
              {ideas.map((idea) => (
                <button
                  key={idea.text}
                  type="button"
                  className="idea"
                  aria-pressed={text === idea.text}
                  onClick={() => {
                    setText(idea.text)
                    setBoth(idea.both)
                  }}
                >
                  <small>{idea.label}</small>
                  {idea.text}
                </button>
              ))}
              <button type="button" className="chip" onClick={loadIdeas}>{ideas.length ? 'Andere Ideen' : 'Ideen zeigen'}</button>
            </div>

            <label className="switch-row">
              <span>
                <strong>Wir antworten beide</strong>
                <small>Die Antworten werden erst sichtbar, wenn ihr beide geantwortet habt.</small>
              </span>
              <input type="checkbox" className="switch" checked={both} onChange={(e) => setBoth(e.target.checked)} />
            </label>

            <button type="button" className="btn-primary" disabled={sending || text.trim().length < 3} onClick={send}>
              {sending ? 'Fragt …' : 'Frage stellen'}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

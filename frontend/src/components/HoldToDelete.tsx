import { useRef, useState } from 'react'

/** Gedrückt halten zum Löschen: gleichmäßig füllen, beim Loslassen schnell zurück.
 *  Lang genug, dass es kein Versehen ist, kurz genug, dass es nicht nervt.
 *  Die Dauer geht als CSS-Variable mit, damit Balken und Auslösen nie auseinanderlaufen. */
const HALTEN_MS = 900
export default function HoldToDelete({ onConfirm, label = 'Halten zum Löschen' }: { onConfirm: () => void; label?: string }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number>()

  const start = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Zeiger festhalten, damit das umgebende Sheet (Vaul) den Druck nicht als Ziehen übernimmt
    e.currentTarget.setPointerCapture(e.pointerId)
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setHolding(false)
      navigator.vibrate?.(30)
      onConfirm()
    }, HALTEN_MS)
  }
  const stop = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  return (
    <button
      type="button"
      className="hold"
      style={{ '--halten': `${HALTEN_MS}ms` } as React.CSSProperties}
      data-holding={holding || undefined}
      data-vaul-no-drag
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
      <span className="hold-fill" aria-hidden="true">{label}</span>
    </button>
  )
}

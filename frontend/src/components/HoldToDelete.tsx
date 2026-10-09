import { useRef, useState } from 'react'

/** Gedrückt halten zum Löschen: 2 s gleichmäßig füllen, beim Loslassen schnell zurück. */
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
    }, 2000)
  }
  const stop = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  return (
    <button
      type="button"
      className="hold"
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

interface Props<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  activeColor?: string
  activeText?: string
  label: string
}

/** Der aktive Teil wird per clip-path aufgedeckt: Hintergrund und Text wechseln exakt gleichzeitig. */
export default function Segmented<T extends string>({ options, value, onChange, activeColor, activeText, label }: Props<T>) {
  const n = options.length
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  const left = (i / n) * 100
  const right = ((n - 1 - i) / n) * 100
  return (
    <div className="segmented" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
      <div
        className="segmented-active"
        aria-hidden="true"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          clipPath: `inset(0 ${right}% 0 ${left}% round 999px)`,
          background: activeColor,
          color: activeText,
        }}
      >
        {options.map((o) => (
          <span key={o.value}>{o.label}</span>
        ))}
      </div>
    </div>
  )
}

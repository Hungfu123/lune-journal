/**
 * Ladezustände. Platzhalter statt leerer Fläche: man sieht sofort, dass gleich
 * etwas kommt und wie es ungefähr aussehen wird.
 */

/** Grauer Platzhalter in der Form des späteren Inhalts. */
export function Skeleton({ w, h, round }: { w?: string; h?: number; round?: boolean }) {
  return <span className="skeleton" style={{ width: w ?? '100%', height: h ?? 14, borderRadius: round ? '50%' : undefined }} />
}

/** Dreht sich, solange etwas unterwegs ist. */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner" role="status" aria-label={label ?? 'Lädt'}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** Platzhalter für die Timeline beim ersten Laden. */
export function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton-head">
            <Skeleton w="36px" h={36} round />
            <div className="skeleton-lines">
              <Skeleton w="38%" h={13} />
              <Skeleton w="24%" h={11} />
            </div>
          </div>
          {i === 0 && <Skeleton h={180} />}
          <Skeleton w="92%" h={15} />
          <Skeleton w="64%" h={15} />
        </div>
      ))}
    </div>
  )
}

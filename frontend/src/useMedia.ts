import { useEffect, useState } from 'react'

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

export const DESKTOP = '(min-width: 960px)'
export const useIsDesktop = () => useMedia(DESKTOP)
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Unten auf dem Handy, rechts als Seitenpanel am Desktop. */
export const useSheetDirection = (): 'bottom' | 'right' => (useIsDesktop() ? 'right' : 'bottom')

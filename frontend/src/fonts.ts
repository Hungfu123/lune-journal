import type { Theme } from './types'

const THEMES: Theme[] = ['sunset', 'ocean', 'night', 'zitrone', 'tiefsee', 'wald', 'lavendel', 'retro', 'kino', 'bonbon', 'polaroid', 'puder', 'himmel', 'mandel']

export const THEME_KEYS = THEMES

export function normalizeTheme(t: string | null | undefined): Theme {
  return t && (THEME_KEYS as string[]).includes(t) ? (t as Theme) : 'sunset'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* privater Modus */
  }
  // Statusleiste auf dem Pixel passend einfärben
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

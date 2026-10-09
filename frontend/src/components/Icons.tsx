const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Plus = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" {...base} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
)
export const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></svg>
)
export const Heart = ({ filled }: { filled: boolean }) => (
  <svg className="heart" width="18" height="18" viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
)
export const Camera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)
export const Gallery = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
)
export const Speech = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base}><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z" /></svg>
)
export const Pin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...base}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
)
export const More = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></svg>
)
export const Close = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const Book = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" />
  </svg>
)
export const GPhotos = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12V4a4 4 0 0 1 4 4zM12 12h8a4 4 0 0 1-4 4zM12 12v8a4 4 0 0 1-4-4zM12 12H4a4 4 0 0 1 4-4z" />
  </svg>
)
export const Expand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
)
export const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

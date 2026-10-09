import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { api, ApiError } from './api'
import { applyTheme, normalizeTheme } from './fonts'
import Login from './components/Login'
import Timeline from './components/Timeline'
import type { Me } from './types'

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)

  useEffect(() => {
    api
      .get<Me>('/api/auth/me')
      .then(setMe)
      .catch((e) => setMe(e instanceof ApiError && e.status === 401 ? null : null))
  }, [])

  useEffect(() => {
    applyTheme(normalizeTheme(me?.theme ?? localStorage.getItem('theme')))
  }, [me?.theme])

  return (
    <>
      {me === undefined ? null : me === null ? <Login onLogin={setMe} /> : <Timeline me={me} onMeChange={setMe} />}
      <Toaster position="top-center" offset={14} toastOptions={{ className: 'toast' }} />
    </>
  )
}

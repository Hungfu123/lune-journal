import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Me } from '../types'


export default function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!window.google || !ref.current) return
      window.clearInterval(timer)
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        auto_select: true,
        callback: async ({ credential }) => {
          try {
            onLogin(await api.post<Me>('/api/auth/google', { credential }))
          } catch (e) {
            setError((e as Error).message)
          }
        },
      })
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'de' })
    }, 100)
    return () => window.clearInterval(timer)
  }, [onLogin])

  return (
    <main className="login">
      <div className="login-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <h1>Lune Journal</h1>
      <p>Nur für uns zwei.</p>
      <div ref={ref} className="login-button" />
      {error && <p className="login-error" role="alert">{error}</p>}
    </main>
  )
}

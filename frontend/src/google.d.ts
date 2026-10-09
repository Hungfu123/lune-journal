export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
        }
        oauth2?: {
          initTokenClient: (o: {
            client_id: string
            scope: string
            callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void
          }) => { requestAccessToken: (o?: { prompt?: string }) => void }
        }
      }
    }
  }
}

import { api } from './api'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function shouldAskForPush(): boolean {
  return pushSupported() && Notification.permission === 'default' && !localStorage.getItem('push-asked')
}

export async function enablePush(): Promise<boolean> {
  localStorage.setItem('push-asked', '1')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const { key } = await api.get<{ key: string }>('/api/push/key')
  if (!key) return false
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await api.post('/api/push/subscribe', sub.toJSON())
  return true
}

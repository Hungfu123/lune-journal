const ALLGEMEIN = 'Das hat nicht geklappt. Prüf die Verbindung und versuch es nochmal.'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (!res.ok) {
    let msg = ALLGEMEIN
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') msg = data.detail
    } catch {
      /* keine JSON-Antwort */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

/**
 * Datei hochladen und dabei den Fortschritt melden. `fetch` kann das nicht —
 * es gibt kein Ereignis für den Upload —, deshalb hier XMLHttpRequest.
 * `onProgress` bekommt einen Wert zwischen 0 und 1.
 */
export function upload<T>(url: string, file: File, onProgress: (anteil: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* keine JSON-Antwort */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T)
      const detail = (data as { detail?: unknown } | null)?.detail
      reject(new ApiError(xhr.status, typeof detail === 'string' ? detail : ALLGEMEIN))
    }
    xhr.onerror = () => reject(new ApiError(0, ALLGEMEIN))
    xhr.ontimeout = () => reject(new ApiError(0, ALLGEMEIN))
    xhr.send(form)
  })
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
}

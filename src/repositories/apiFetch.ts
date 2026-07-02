import type { Result } from '@/types'

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const code = res.status === 404 ? 'NOT_FOUND' : 'DB_ERROR'
      return {
        ok: false,
        error: { code, message: (body as { error?: string }).error ?? res.statusText },
      }
    }
    if (res.status === 204) return { ok: true, data: undefined as T }
    return { ok: true, data: (await res.json()) as T }
  } catch (e) {
    return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
  }
}

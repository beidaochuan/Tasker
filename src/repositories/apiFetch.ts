import type { AppError, Result } from '@/types'

function errorCodeForStatus(status: number): AppError['code'] {
  if (status === 400 || status === 413) return 'VALIDATION_ERROR'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  return 'DB_ERROR'
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const code = errorCodeForStatus(res.status)
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

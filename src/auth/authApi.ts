import { z } from 'zod'

const authSessionResponseSchema = z
  .object({
    isAuthenticated: z.boolean(),
    csrfToken: z.string().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    expiresInMs: z.number().int().nonnegative().optional(),
  })
  .passthrough()

export type AuthSession =
  | { isAuthenticated: false; csrfToken: null; expiresAt: null; expiresInMs: null }
  | { isAuthenticated: true; csrfToken: string; expiresAt: number; expiresInMs: number }

export type LoginResult =
  | { ok: true; session: Extract<AuthSession, { isAuthenticated: true }> }
  | {
      ok: false
      reason: 'invalid_credentials' | 'rate_limited' | 'unavailable'
      retryAfterSeconds?: number
    }

export type LogoutResult = { ok: true } | { ok: false; reason: 'csrf_invalid' | 'unavailable' }

const AUTH_FETCH_OPTIONS = {
  cache: 'no-store',
  credentials: 'same-origin',
} as const satisfies RequestInit

async function readSessionResponse(response: Response): Promise<AuthSession> {
  const body: unknown = await response.json()
  const parsed = authSessionResponseSchema.safeParse(body)
  if (!parsed.success) throw new Error('認証状態APIのレスポンス形式が不正です')

  if (!parsed.data.isAuthenticated) {
    return { isAuthenticated: false, csrfToken: null, expiresAt: null, expiresInMs: null }
  }
  if (!parsed.data.csrfToken || !parsed.data.expiresAt || parsed.data.expiresInMs === undefined) {
    throw new Error('認証状態APIのセッション情報が不足しています')
  }
  return {
    isAuthenticated: true,
    csrfToken: parsed.data.csrfToken,
    expiresAt: parsed.data.expiresAt,
    expiresInMs: parsed.data.expiresInMs,
  }
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const response = await fetch('/api/auth/session', AUTH_FETCH_OPTIONS)
  if (response.status === 401) {
    return { isAuthenticated: false, csrfToken: null, expiresAt: null, expiresInMs: null }
  }
  if (!response.ok) throw new Error(`認証状態の取得に失敗しました: HTTP ${response.status}`)
  return readSessionResponse(response)
}

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<LoginResult> {
  let response: Response
  try {
    response = await fetch('/api/auth/login', {
      ...AUTH_FETCH_OPTIONS,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  if (response.status === 401) return { ok: false, reason: 'invalid_credentials' }
  if (response.status === 429) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('Retry-After')),
    }
  }
  if (!response.ok) return { ok: false, reason: 'unavailable' }

  try {
    const session = await readSessionResponse(response)
    return session.isAuthenticated ? { ok: true, session } : { ok: false, reason: 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export async function logoutSession(csrfToken: string | null): Promise<LogoutResult> {
  const headers = new Headers()
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)

  try {
    const response = await fetch('/api/auth/logout', {
      ...AUTH_FETCH_OPTIONS,
      method: 'POST',
      headers,
    })
    // 期限切れなどですでにセッションがない場合も、クライアント上はログアウト済みとする。
    if (response.ok || response.status === 401) return { ok: true }
    if (response.status === 403) {
      const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined
      if (body?.error === 'CSRF_INVALID') return { ok: false, reason: 'csrf_invalid' }
    }
    return { ok: false, reason: 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

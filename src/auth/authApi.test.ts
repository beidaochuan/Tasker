import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthSession, loginWithCredentials, logoutSession } from './authApi'

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  })
}

describe('authApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('no-storeかつsame-origin Cookieでセッションを復元する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        isAuthenticated: true,
        csrfToken: 'csrf-session',
        expiresAt: 123,
        expiresInMs: 60_000,
      })
    )

    await expect(fetchAuthSession()).resolves.toEqual({
      isAuthenticated: true,
      csrfToken: 'csrf-session',
      expiresAt: 123,
      expiresInMs: 60_000,
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/session', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
  })

  it('未認証のセッション状態を受け入れる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ isAuthenticated: false }))

    await expect(fetchAuthSession()).resolves.toEqual({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      expiresInMs: null,
    })
  })

  it('ログイン資格情報をPOSTし、返されたCSRFトークンを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        isAuthenticated: true,
        csrfToken: 'csrf-login',
        expiresAt: 456,
        expiresInMs: 30_000,
      })
    )

    await expect(loginWithCredentials('operator', 'entered-password')).resolves.toEqual({
      ok: true,
      session: {
        isAuthenticated: true,
        csrfToken: 'csrf-login',
        expiresAt: 456,
        expiresInMs: 30_000,
      },
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'operator', password: 'entered-password' }),
      })
    )
  })

  it('ログイン試行制限とRetry-Afterを区別する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: 'RATE_LIMITED' }, 429, { 'Retry-After': '45' })
    )

    await expect(loginWithCredentials('operator', 'wrong-password')).resolves.toEqual({
      ok: false,
      reason: 'rate_limited',
      retryAfterSeconds: 45,
    })
  })

  it('認証済みレスポンスに相対有効期間がなければ拒否する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ isAuthenticated: true, csrfToken: 'csrf-session', expiresAt: 123 })
    )

    await expect(fetchAuthSession()).rejects.toThrow('セッション情報が不足しています')
  })

  it('ログアウトへメモリ上のCSRFトークンを付与する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(logoutSession('csrf-logout')).resolves.toEqual({ ok: true })

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
        method: 'POST',
      })
    )
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-logout')
  })

  it('ログアウトのCSRF不一致を再同期可能な理由として返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'CSRF_INVALID' }, 403))

    await expect(logoutSession('csrf-stale')).resolves.toEqual({
      ok: false,
      reason: 'csrf_invalid',
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { useAuthStore } from '@/store/authStore'
import { apiFetch, apiFetchNoContent } from '../apiFetch'

interface MockResponseOptions {
  body?: unknown
  jsonError?: unknown
  ok?: boolean
  status?: number
  statusText?: string
}

function mockFetchResponse({
  body,
  jsonError,
  ok = true,
  status = 200,
  statusText = '',
}: MockResponseOptions = {}) {
  const json = vi.fn(() =>
    jsonError === undefined ? Promise.resolve(body) : Promise.reject(jsonError)
  )
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    statusText,
    json,
  } as unknown as Response)
  return json
}

beforeEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState({
    isAuthenticated: false,
    isSessionChecked: true,
    isRestoring: false,
    csrfToken: null,
    expiresAt: null,
    isLoginDialogOpen: false,
  })
})

afterEach(() => {
  useAuthStore.getState().handleUnauthorized()
})

describe('apiFetch', () => {
  it('正常なJSONレスポンスをスキーマで検証して返す', async () => {
    mockFetchResponse({ body: { id: 'task-1', count: 2 } })
    const responseSchema = z.object({ id: z.string(), count: z.number().int() })
    const init = { headers: { Accept: 'application/json' } }

    const result = await apiFetch('/api/test', { responseSchema, init })

    expect(result).toEqual({ ok: true, data: { id: 'task-1', count: 2 } })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', {
      ...init,
      credentials: 'same-origin',
    })
  })

  it('unsafe methodだけにメモリ上のCSRFトークンを既存headerと合成する', async () => {
    useAuthStore.setState({ isAuthenticated: true, csrfToken: 'csrf-token' })
    mockFetchResponse({ status: 204 })

    await apiFetchNoContent('/api/test', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-1' },
      body: '{}',
    })

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(init).toMatchObject({ method: 'PATCH', body: '{}', credentials: 'same-origin' })
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Request-ID')).toBe('request-1')
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token')
  })

  it('未認証のunsafe requestは送信せずログインダイアログを開く', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const result = await apiFetchNoContent('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '作成させない' }),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      isLoginDialogOpen: true,
    })
  })

  it('公開GETにはCSRFトークンを付与しない', async () => {
    useAuthStore.setState({ isAuthenticated: true, csrfToken: 'csrf-token' })
    mockFetchResponse({ body: { id: 'task-1' } })

    await apiFetch('/api/test', { responseSchema: z.object({ id: z.string() }) })

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).has('X-CSRF-Token')).toBe(false)
  })

  it('401でUNAUTHORIZEDを返し、認証状態を破棄してログインダイアログを開く', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      csrfToken: 'expired-token',
      expiresAt: Date.now() + 60_000,
      isLoginDialogOpen: false,
    })
    mockFetchResponse({
      body: { error: 'UNAUTHORIZED' },
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    const result = await apiFetch('/api/test', { responseSchema: z.never() })

    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' },
    })
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      csrfToken: null,
      expiresAt: null,
      isLoginDialogOpen: true,
    })
  })

  it('古いrequestの401は新しいlogin状態を無効化しない', async () => {
    let resolveResponse!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
    )
    useAuthStore.setState({
      isAuthenticated: true,
      csrfToken: 'csrf-old',
      expiresAt: Date.now() + 30_000,
      isLoginDialogOpen: false,
    })

    const request = apiFetchNoContent('/api/test', { method: 'DELETE' })
    const newExpiresAt = Date.now() + 60_000
    useAuthStore.setState({
      isAuthenticated: true,
      csrfToken: 'csrf-new',
      expiresAt: newExpiresAt,
      isLoginDialogOpen: false,
    })
    resolveResponse({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'UNAUTHORIZED' }),
    } as unknown as Response)

    const result = await request

    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' },
    })
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-new',
      expiresAt: newExpiresAt,
      isLoginDialogOpen: false,
    })
  })

  it('CSRF_INVALIDはmutationを再試行せずセッションだけをforce refreshする', async () => {
    const newExpiresAt = Date.now() + 60_000
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'CSRF_INVALID' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            isAuthenticated: true,
            csrfToken: 'csrf-refreshed',
            expiresAt: newExpiresAt,
            expiresInMs: 60_000,
          }),
      } as unknown as Response)
    useAuthStore.setState({
      isAuthenticated: true,
      csrfToken: 'csrf-stale',
      expiresAt: Date.now() + 30_000,
    })

    const result = await apiFetchNoContent('/api/test', { method: 'PATCH' })

    expect(result).toEqual({
      ok: false,
      error: { code: 'CSRF_INVALID', message: 'CSRF_INVALID' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/test', '/api/auth/session'])
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      csrfToken: 'csrf-refreshed',
      expiresAt: newExpiresAt,
    })
  })

  it('2xxでもJSONがZodスキーマに一致しなければINVALID_RESPONSEを返す', async () => {
    mockFetchResponse({ body: { id: 123 } })

    const result = await apiFetch('/api/test', {
      responseSchema: z.object({ id: z.string() }),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_RESPONSE')
    expect(result.error.message).toContain('/api/test')
    expect(result.error.message).toContain('id')
  })

  it('成功レスポンスのJSON解析に失敗したらINVALID_RESPONSEを返す', async () => {
    mockFetchResponse({ jsonError: new SyntaxError('Unexpected token') })

    const result = await apiFetch('/api/test', {
      responseSchema: z.object({ id: z.string() }),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      code: 'INVALID_RESPONSE',
      message: 'APIレスポンスの形式が不正です: /api/test (JSONを読み取れませんでした)',
    })
  })

  it('JSONレスポンスを期待するendpointの204はINVALID_RESPONSEとして拒否する', async () => {
    const json = mockFetchResponse({ status: 204 })

    const result = await apiFetch('/api/test', {
      responseSchema: z.object({ id: z.string() }),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_RESPONSE')
    expect(json).not.toHaveBeenCalled()
  })

  it('no-content専用経路の204はJSONを読まずに成功する', async () => {
    const json = mockFetchResponse({ status: 204 })

    const result = await apiFetchNoContent('/api/test')

    expect(result).toEqual({ ok: true, data: undefined })
    expect(json).not.toHaveBeenCalled()
  })

  it('no-content endpointで204以外が返ればINVALID_RESPONSEとして拒否する', async () => {
    const json = mockFetchResponse({ body: {}, status: 200 })

    const result = await apiFetchNoContent('/api/test')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_RESPONSE')
    expect(json).not.toHaveBeenCalled()
  })

  it('正しいエラー本文ではHTTP status由来のcodeとAPIエラー名を返す', async () => {
    mockFetchResponse({
      body: { error: 'DUPLICATE', message: '同名のタグが存在します' },
      ok: false,
      status: 409,
      statusText: 'Conflict',
    })

    const result = await apiFetch('/api/test', {
      responseSchema: z.never(),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'CONFLICT', message: 'DUPLICATE' },
    })
  })

  it('不正なエラー本文でもHTTP status由来のcodeを維持する', async () => {
    mockFetchResponse({
      body: { error: 123 },
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await apiFetch('/api/test', {
      responseSchema: z.never(),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Not Found' },
    })
  })

  it('エラーレスポンスがJSONでなくてもHTTP status由来のcodeを維持する', async () => {
    mockFetchResponse({
      jsonError: new SyntaxError('Unexpected token'),
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    })

    const result = await apiFetch('/api/test', {
      responseSchema: z.never(),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Bad Request' },
    })
  })

  it('network failureをthrowせずResultエラーとして返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await apiFetch('/api/test', {
      responseSchema: z.object({ id: z.string() }),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'DB_ERROR', message: 'TypeError: Failed to fetch' },
    })
  })
})

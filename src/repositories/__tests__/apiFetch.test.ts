import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
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
})

describe('apiFetch', () => {
  it('正常なJSONレスポンスをスキーマで検証して返す', async () => {
    mockFetchResponse({ body: { id: 'task-1', count: 2 } })
    const responseSchema = z.object({ id: z.string(), count: z.number().int() })
    const init = { headers: { Accept: 'application/json' } }

    const result = await apiFetch('/api/test', { responseSchema, init })

    expect(result).toEqual({ ok: true, data: { id: 'task-1', count: 2 } })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', init)
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

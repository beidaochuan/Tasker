import type { AppError, Result } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { z, type ZodTypeAny } from 'zod'

const errorBodySchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
  })
  .passthrough()

interface ApiFetchOptions<TSchema extends ZodTypeAny> {
  responseSchema: TSchema
  init?: RequestInit
}

function errorCodeForStatus(status: number): AppError['code'] {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 400 || status === 413) return 'VALIDATION_ERROR'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  return 'DB_ERROR'
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

interface PreparedRequest {
  init: RequestInit
  csrfToken: string | null
  isLocallyAuthorized: boolean
}

function prepareRequest(init?: RequestInit): PreparedRequest {
  const requestInit: RequestInit = { ...init, credentials: 'same-origin' }
  const { isAuthenticated, csrfToken } = useAuthStore.getState()
  const method = (init?.method ?? 'GET').toUpperCase()
  if (SAFE_METHODS.has(method)) {
    return { init: requestInit, csrfToken, isLocallyAuthorized: true }
  }
  if (!isAuthenticated) {
    return { init: requestInit, csrfToken, isLocallyAuthorized: false }
  }
  if (!csrfToken) return { init: requestInit, csrfToken, isLocallyAuthorized: true }

  const headers = new Headers(init?.headers)
  headers.set('X-CSRF-Token', csrfToken)
  return { init: { ...requestInit, headers }, csrfToken, isLocallyAuthorized: true }
}

function responseValidationError(url: string, detail?: string): Result<never> {
  return {
    ok: false,
    error: {
      code: 'INVALID_RESPONSE',
      message: `APIレスポンスの形式が不正です: ${url}${detail ? ` (${detail})` : ''}`,
    },
  }
}

function firstIssueDetail(error: z.ZodError): string | undefined {
  const issue = error.issues[0]
  if (!issue) return undefined
  const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
  return `${path}: ${issue.message}`
}

async function fetchResponse(url: string, init?: RequestInit): Promise<Result<Response>> {
  let res: Response
  const request = prepareRequest(init)
  if (!request.isLocallyAuthorized) {
    useAuthStore.getState().openLoginDialog()
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'ログインが必要です' },
    }
  }
  try {
    res = await fetch(url, request.init)
  } catch (e) {
    return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
  }

  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().handleUnauthorized(request.csrfToken)
    }
    const body = await res.json().catch(() => undefined)
    const parsedBody = errorBodySchema.safeParse(body)
    const isCsrfInvalid =
      res.status === 403 && parsedBody.success && parsedBody.data.error === 'CSRF_INVALID'
    if (isCsrfInvalid && useAuthStore.getState().csrfToken === request.csrfToken) {
      // mutation自体は再試行せず、別タブでrotateされたCookie/CSRF状態だけを取り直す。
      await useAuthStore.getState().forceRefreshSession()
    }
    const code = isCsrfInvalid ? 'CSRF_INVALID' : errorCodeForStatus(res.status)
    const fallbackMessage = res.statusText || `HTTP ${res.status}`
    return {
      ok: false,
      error: { code, message: parsedBody.success ? parsedBody.data.error : fallbackMessage },
    }
  }

  return { ok: true, data: res }
}

export async function apiFetch<TSchema extends ZodTypeAny>(
  url: string,
  { responseSchema, init }: ApiFetchOptions<TSchema>
): Promise<Result<z.output<TSchema>>> {
  const fetched = await fetchResponse(url, init)
  if (!fetched.ok) return fetched
  const res = fetched.data

  if (res.status === 204) {
    return responseValidationError(url, 'JSONレスポンスがありません')
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return responseValidationError(url, 'JSONを読み取れませんでした')
  }

  const parsedBody = responseSchema.safeParse(body)
  if (!parsedBody.success) {
    return responseValidationError(url, firstIssueDetail(parsedBody.error))
  }
  return { ok: true, data: parsedBody.data }
}

export async function apiFetchNoContent(url: string, init?: RequestInit): Promise<Result<void>> {
  const fetched = await fetchResponse(url, init)
  if (!fetched.ok) return fetched
  if (fetched.data.status !== 204) {
    return responseValidationError(url, `204ではなくHTTP ${fetched.data.status}が返されました`)
  }
  return { ok: true, data: undefined }
}

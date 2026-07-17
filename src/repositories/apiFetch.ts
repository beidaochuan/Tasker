import type { AppError, Result } from '@/types'
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
  if (status === 400 || status === 413) return 'VALIDATION_ERROR'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  return 'DB_ERROR'
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
  try {
    res = await fetch(url, init)
  } catch (e) {
    return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    const parsedBody = errorBodySchema.safeParse(body)
    const code = errorCodeForStatus(res.status)
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

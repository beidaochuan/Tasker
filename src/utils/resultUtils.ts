import type { Result } from '@/types'

export function unwrapResult<T>(result: Result<T>): T {
  if (result.ok) return result.data
  throw new Error(result.error.message)
}

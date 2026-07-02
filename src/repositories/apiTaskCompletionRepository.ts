import type { TaskCompletion, Result } from '@/types'
import type { ITaskCompletionRepository } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'
import { apiFetch } from './apiFetch'

const BASE = '/api/completions'

function toCompletion(raw: Record<string, unknown>): TaskCompletion {
  return {
    id: raw.id as string,
    taskId: raw.taskId as string,
    completedAt: fromUnixMs(raw.completedAt as number),
  }
}

export class ApiTaskCompletionRepository implements ITaskCompletionRepository {
  async getByTaskId(taskId: string): Promise<Result<TaskCompletion[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(
      `${BASE}?taskId=${encodeURIComponent(taskId)}`
    )
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toCompletion) }
  }

  async create(taskId: string): Promise<Result<TaskCompletion>> {
    const r = await apiFetch<Record<string, unknown>>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    })
    if (!r.ok) return r
    return { ok: true, data: toCompletion(r.data) }
  }
}

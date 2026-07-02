import type { Subtask, Result } from '@/types'
import type { ISubtaskRepository, CreateSubtask, UpdateSubtask } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'
import { apiFetch } from './apiFetch'

const BASE = '/api/subtasks'

function toSubtask(raw: Record<string, unknown>): Subtask {
  return {
    id: raw.id as string,
    taskId: raw.taskId as string,
    title: raw.title as string,
    isDone: Boolean(raw.isDone),
    order: raw.order as number,
    createdAt: fromUnixMs(raw.createdAt as number),
  }
}

export class ApiSubtaskRepository implements ISubtaskRepository {
  async getByTaskId(taskId: string): Promise<Result<Subtask[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(
      `${BASE}?taskId=${encodeURIComponent(taskId)}`
    )
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toSubtask) }
  }

  async create(data: CreateSubtask): Promise<Result<Subtask>> {
    const r = await apiFetch<Record<string, unknown>>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toSubtask(r.data) }
  }

  async update(id: string, data: UpdateSubtask): Promise<Result<Subtask>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toSubtask(r.data) }
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

import type { Task, Result } from '@/types'
import type {
  ITaskRepository,
  CreateTask,
  UpdateTask,
  CompleteRecurringTaskResult,
} from './interface'
import { fromUnixMs, toUnixMs } from '@/utils/dateUtils'
import { apiFetch } from './apiFetch'

const BASE = '/api/tasks'

function toTask(raw: Record<string, unknown>): Task {
  return {
    id: raw.id as string,
    topicId: raw.topicId as string,
    title: raw.title as string,
    description: raw.description as string,
    status: raw.status as Task['status'],
    priority: raw.priority as Task['priority'],
    dueDate: raw.dueDate != null ? fromUnixMs(raw.dueDate as number) : null,
    startDate: raw.startDate != null ? fromUnixMs(raw.startDate as number) : null,
    order: raw.order as number,
    ganttOrder: raw.ganttOrder == null ? null : (raw.ganttOrder as number),
    tags: raw.tags as string[],
    repeatRule: raw.repeatRule as string | null,
    createdAt: fromUnixMs(raw.createdAt as number),
    updatedAt: fromUnixMs(raw.updatedAt as number),
  }
}

function serializeTask(data: CreateTask | UpdateTask): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }
  if ('dueDate' in data && data.dueDate !== undefined) {
    result.dueDate = data.dueDate !== null ? toUnixMs(data.dueDate) : null
  }
  if ('startDate' in data && data.startDate !== undefined) {
    result.startDate = data.startDate !== null ? toUnixMs(data.startDate) : null
  }
  return result
}

export class ApiTaskRepository implements ITaskRepository {
  async getByTopicId(topicId: string): Promise<Result<Task[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(
      `${BASE}?topicId=${encodeURIComponent(topicId)}`
    )
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toTask) }
  }

  async getByProjectId(projectId: string): Promise<Result<Task[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(
      `${BASE}?projectId=${encodeURIComponent(projectId)}`
    )
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toTask) }
  }

  async getById(id: string): Promise<Result<Task>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`)
    if (!r.ok) return r
    return { ok: true, data: toTask(r.data) }
  }

  async create(data: CreateTask): Promise<Result<Task>> {
    const r = await apiFetch<Record<string, unknown>>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeTask(data)),
    })
    if (!r.ok) return r
    return { ok: true, data: toTask(r.data) }
  }

  async update(id: string, data: UpdateTask): Promise<Result<Task>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeTask(data)),
    })
    if (!r.ok) return r
    return { ok: true, data: toTask(r.data) }
  }

  async completeRecurring(
    id: string,
    nextTask: CreateTask | null
  ): Promise<Result<CompleteRecurringTaskResult>> {
    const r = await apiFetch<{
      task: Record<string, unknown>
      completion: Record<string, unknown>
      nextTask: Record<string, unknown> | null
    }>(`${BASE}/${id}/complete-recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nextTask: nextTask ? serializeTask(nextTask) : null,
      }),
    })
    if (!r.ok) return r
    return {
      ok: true,
      data: {
        task: toTask(r.data.task),
        completion: {
          id: r.data.completion.id as string,
          taskId: r.data.completion.taskId as string,
          completedAt: fromUnixMs(r.data.completion.completedAt as number),
        },
        nextTask: r.data.nextTask ? toTask(r.data.nextTask) : null,
      },
    }
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

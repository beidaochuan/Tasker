import type { Topic, Result } from '@/types'
import type { ITopicRepository, CreateTopic, UpdateTopic } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'
import { apiFetch } from './apiFetch'

const BASE = '/api/topics'

function toTopic(raw: Record<string, unknown>): Topic {
  return {
    id: raw.id as string,
    projectId: raw.projectId as string,
    name: raw.name as string,
    order: raw.order as number,
    createdAt: fromUnixMs(raw.createdAt as number),
  }
}

export class ApiTopicRepository implements ITopicRepository {
  async getByProjectId(projectId: string): Promise<Result<Topic[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(
      `${BASE}?projectId=${encodeURIComponent(projectId)}`
    )
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toTopic) }
  }

  async getById(id: string): Promise<Result<Topic>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`)
    if (!r.ok) return r
    return { ok: true, data: toTopic(r.data) }
  }

  async create(data: CreateTopic): Promise<Result<Topic>> {
    const r = await apiFetch<Record<string, unknown>>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toTopic(r.data) }
  }

  async update(id: string, data: UpdateTopic): Promise<Result<Topic>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toTopic(r.data) }
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

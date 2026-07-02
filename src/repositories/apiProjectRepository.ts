import type { Project, Result } from '@/types'
import type { IProjectRepository, CreateProject, UpdateProject } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'
import { apiFetch } from './apiFetch'

const BASE = '/api/projects'

function toProject(raw: Record<string, unknown>): Project {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string,
    color: raw.color as string,
    status: raw.status as Project['status'],
    isArchived: Boolean(raw.isArchived),
    createdAt: fromUnixMs(raw.createdAt as number),
    updatedAt: fromUnixMs(raw.updatedAt as number),
  }
}

export class ApiProjectRepository implements IProjectRepository {
  async getAll(): Promise<Result<Project[]>> {
    const r = await apiFetch<Record<string, unknown>[]>(BASE)
    if (!r.ok) return r
    return { ok: true, data: r.data.map(toProject) }
  }

  async getById(id: string): Promise<Result<Project>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`)
    if (!r.ok) return r
    return { ok: true, data: toProject(r.data) }
  }

  async create(data: CreateProject): Promise<Result<Project>> {
    const r = await apiFetch<Record<string, unknown>>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toProject(r.data) }
  }

  async update(id: string, data: UpdateProject): Promise<Result<Project>> {
    const r = await apiFetch<Record<string, unknown>>(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return r
    return { ok: true, data: toProject(r.data) }
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

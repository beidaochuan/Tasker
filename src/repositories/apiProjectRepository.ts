import type { Project, Result } from '@/types'
import type { IProjectRepository, CreateProject, UpdateProject } from './interface'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import { projectResponseSchema, projectsResponseSchema } from './apiResponseSchemas'

const BASE = '/api/projects'

export class ApiProjectRepository implements IProjectRepository {
  async getAll(): Promise<Result<Project[]>> {
    return apiFetch(BASE, { responseSchema: projectsResponseSchema })
  }

  async getById(id: string): Promise<Result<Project>> {
    return apiFetch(`${BASE}/${id}`, { responseSchema: projectResponseSchema })
  }

  async create(data: CreateProject): Promise<Result<Project>> {
    return apiFetch(BASE, {
      responseSchema: projectResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async update(id: string, data: UpdateProject): Promise<Result<Project>> {
    return apiFetch(`${BASE}/${id}`, {
      responseSchema: projectResponseSchema,
      init: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetchNoContent(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

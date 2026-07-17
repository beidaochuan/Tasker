import type { Topic, Result } from '@/types'
import type { ITopicRepository, CreateTopic, UpdateTopic } from './interface'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import { topicResponseSchema, topicsResponseSchema } from './apiResponseSchemas'

const BASE = '/api/topics'

export class ApiTopicRepository implements ITopicRepository {
  async getByProjectId(projectId: string): Promise<Result<Topic[]>> {
    return apiFetch(`${BASE}?projectId=${encodeURIComponent(projectId)}`, {
      responseSchema: topicsResponseSchema,
    })
  }

  async getById(id: string): Promise<Result<Topic>> {
    return apiFetch(`${BASE}/${id}`, { responseSchema: topicResponseSchema })
  }

  async create(data: CreateTopic): Promise<Result<Topic>> {
    return apiFetch(BASE, {
      responseSchema: topicResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async update(id: string, data: UpdateTopic): Promise<Result<Topic>> {
    return apiFetch(`${BASE}/${id}`, {
      responseSchema: topicResponseSchema,
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

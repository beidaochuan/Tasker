import type { Tag, Result } from '@/types'
import type { ITagRepository, CreateTag } from './interface'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import { tagResponseSchema, tagsResponseSchema } from './apiResponseSchemas'

const BASE = '/api/tags'

export class ApiTagRepository implements ITagRepository {
  async getAll(): Promise<Result<Tag[]>> {
    return apiFetch(BASE, { responseSchema: tagsResponseSchema })
  }

  async create(data: CreateTag): Promise<Result<Tag>> {
    return apiFetch(BASE, {
      responseSchema: tagResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetchNoContent(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

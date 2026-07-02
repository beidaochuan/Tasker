import type { Tag, Result } from '@/types'
import type { ITagRepository, CreateTag } from './interface'
import { apiFetch } from './apiFetch'

const BASE = '/api/tags'

export class ApiTagRepository implements ITagRepository {
  async getAll(): Promise<Result<Tag[]>> {
    return apiFetch<Tag[]>(BASE)
  }

  async create(data: CreateTag): Promise<Result<Tag>> {
    return apiFetch<Tag>(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

import type { TaskComment, Result } from '@/types'
import type { ITaskCommentRepository, CreateTaskComment, UpdateTaskComment } from './interface'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import { commentResponseSchema, commentsResponseSchema } from './apiResponseSchemas'

const BASE = '/api/comments'

export class ApiTaskCommentRepository implements ITaskCommentRepository {
  async getByTaskId(taskId: number): Promise<Result<TaskComment[]>> {
    return apiFetch(`${BASE}?taskId=${encodeURIComponent(taskId)}`, {
      responseSchema: commentsResponseSchema,
    })
  }

  async create(data: CreateTaskComment): Promise<Result<TaskComment>> {
    return apiFetch(BASE, {
      responseSchema: commentResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async update(id: string, data: UpdateTaskComment): Promise<Result<TaskComment>> {
    return apiFetch(`${BASE}/${id}`, {
      responseSchema: commentResponseSchema,
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

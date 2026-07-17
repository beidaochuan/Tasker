import type { TaskCompletion, Result } from '@/types'
import type { ITaskCompletionRepository } from './interface'
import { apiFetch } from './apiFetch'
import { completionResponseSchema, completionsResponseSchema } from './apiResponseSchemas'

const BASE = '/api/completions'

export class ApiTaskCompletionRepository implements ITaskCompletionRepository {
  async getByTaskId(taskId: string): Promise<Result<TaskCompletion[]>> {
    return apiFetch(`${BASE}?taskId=${encodeURIComponent(taskId)}`, {
      responseSchema: completionsResponseSchema,
    })
  }

  async create(taskId: string): Promise<Result<TaskCompletion>> {
    return apiFetch(BASE, {
      responseSchema: completionResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      },
    })
  }
}

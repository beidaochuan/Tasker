import type { Subtask, Result } from '@/types'
import type { ISubtaskRepository, CreateSubtask, UpdateSubtask } from './interface'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import { subtaskResponseSchema, subtasksResponseSchema } from './apiResponseSchemas'

const BASE = '/api/subtasks'

export class ApiSubtaskRepository implements ISubtaskRepository {
  async getByTaskId(taskId: string): Promise<Result<Subtask[]>> {
    return apiFetch(`${BASE}?taskId=${encodeURIComponent(taskId)}`, {
      responseSchema: subtasksResponseSchema,
    })
  }

  async create(data: CreateSubtask): Promise<Result<Subtask>> {
    return apiFetch(BASE, {
      responseSchema: subtaskResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    })
  }

  async update(id: string, data: UpdateSubtask): Promise<Result<Subtask>> {
    return apiFetch(`${BASE}/${id}`, {
      responseSchema: subtaskResponseSchema,
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

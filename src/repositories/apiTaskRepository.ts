import type { Task, TaskRelation, Result } from '@/types'
import type {
  ITaskRepository,
  CreateTask,
  UpdateTask,
  GanttOrderUpdate,
  CompleteRecurringTaskResult,
} from './interface'
import { toUnixMs } from '@/utils/dateUtils'
import { apiFetch, apiFetchNoContent } from './apiFetch'
import {
  completeRecurringResponseSchema,
  taskResponseSchema,
  taskRelationsResponseSchema,
  tasksResponseSchema,
} from './apiResponseSchemas'

const BASE = '/api/tasks'

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
  async getAll(): Promise<Result<Task[]>> {
    return apiFetch(BASE, { responseSchema: tasksResponseSchema })
  }

  async getByTopicId(topicId: string): Promise<Result<Task[]>> {
    return apiFetch(`${BASE}?topicId=${encodeURIComponent(topicId)}`, {
      responseSchema: tasksResponseSchema,
    })
  }

  async getByProjectId(projectId: string): Promise<Result<Task[]>> {
    return apiFetch(`${BASE}?projectId=${encodeURIComponent(projectId)}`, {
      responseSchema: tasksResponseSchema,
    })
  }

  async getById(id: string): Promise<Result<Task>> {
    return apiFetch(`${BASE}/${id}`, { responseSchema: taskResponseSchema })
  }

  async create(data: CreateTask): Promise<Result<Task>> {
    return apiFetch(BASE, {
      responseSchema: taskResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeTask(data)),
      },
    })
  }

  async update(id: string, data: UpdateTask): Promise<Result<Task>> {
    return apiFetch(`${BASE}/${id}`, {
      responseSchema: taskResponseSchema,
      init: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeTask(data)),
      },
    })
  }

  async updateGanttOrder(items: GanttOrderUpdate[]): Promise<Result<void>> {
    return apiFetchNoContent(`${BASE}/gantt-order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  }

  async completeRecurring(
    id: string,
    nextTask: CreateTask | null
  ): Promise<Result<CompleteRecurringTaskResult>> {
    return apiFetch(`${BASE}/${id}/complete-recurring`, {
      responseSchema: completeRecurringResponseSchema,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextTask: nextTask ? serializeTask(nextTask) : null,
        }),
      },
    })
  }

  async getRelatedTasks(id: string): Promise<Result<Task[]>> {
    return apiFetch(`${BASE}/${id}/related-tasks`, { responseSchema: tasksResponseSchema })
  }

  async replaceRelatedTasks(id: string, relatedTaskIds: string[]): Promise<Result<Task[]>> {
    return apiFetch(`${BASE}/${id}/related-tasks`, {
      responseSchema: tasksResponseSchema,
      init: {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedTaskIds }),
      },
    })
  }

  async getRelations(): Promise<Result<TaskRelation[]>> {
    return apiFetch(`${BASE}/relations`, { responseSchema: taskRelationsResponseSchema })
  }

  async delete(id: string): Promise<Result<void>> {
    return apiFetchNoContent(`${BASE}/${id}`, { method: 'DELETE' })
  }
}

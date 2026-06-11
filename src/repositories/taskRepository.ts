import { nanoid } from 'nanoid'
import type { TaskerDB, TaskRow } from '@/db/schema'
import type { Task, Result } from '@/types'
import type { CreateTask, UpdateTask } from './interface'
import { fromUnixMs, toUnixMs } from '@/utils/dateUtils'

export function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    dueDate: row.dueDate !== null ? fromUnixMs(row.dueDate) : null,
    startDate: row.startDate !== null ? fromUnixMs(row.startDate) : null,
    createdAt: fromUnixMs(row.createdAt),
    updatedAt: fromUnixMs(row.updatedAt),
  }
}

function taskToRow(task: Task): TaskRow {
  return {
    ...task,
    dueDate: task.dueDate !== null ? toUnixMs(task.dueDate) : null,
    startDate: task.startDate !== null ? toUnixMs(task.startDate) : null,
    createdAt: toUnixMs(task.createdAt),
    updatedAt: toUnixMs(task.updatedAt),
  }
}

export class TaskRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getByTopicId(topicId: string): Promise<Result<Task[]>> {
    try {
      const rows = await this.#db.tasks.where('topicId').equals(topicId).toArray()
      return { ok: true, data: rows.map(rowToTask) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async getById(id: string): Promise<Result<Task>> {
    try {
      const row = await this.#db.tasks.get(id)
      if (!row) return { ok: false, error: { code: 'NOT_FOUND', message: `Task ${id} not found` } }
      return { ok: true, data: rowToTask(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(data: CreateTask): Promise<Result<Task>> {
    try {
      const now = Date.now()
      const task: Task = {
        id: nanoid(10),
        ...data,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      }
      await this.#db.tasks.add(taskToRow(task))
      return { ok: true, data: task }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async update(id: string, data: UpdateTask): Promise<Result<Task>> {
    try {
      const existing = await this.#db.tasks.get(id)
      if (!existing)
        return { ok: false, error: { code: 'NOT_FOUND', message: `Task ${id} not found` } }

      const patch: Partial<TaskRow> = { updatedAt: Date.now() }
      if (data.title !== undefined) patch.title = data.title
      if (data.description !== undefined) patch.description = data.description
      if (data.status !== undefined) patch.status = data.status
      if (data.priority !== undefined) patch.priority = data.priority
      if (data.dueDate !== undefined)
        patch.dueDate = data.dueDate !== null ? toUnixMs(data.dueDate) : null
      if (data.startDate !== undefined)
        patch.startDate = data.startDate !== null ? toUnixMs(data.startDate) : null
      if (data.order !== undefined) patch.order = data.order
      if (data.tags !== undefined) patch.tags = data.tags
      if (data.repeatRule !== undefined) patch.repeatRule = data.repeatRule

      await this.#db.tasks.update(id, patch)
      return { ok: true, data: rowToTask({ ...existing, ...patch }) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.#db.tasks.delete(id)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

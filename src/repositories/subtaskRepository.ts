import { nanoid } from 'nanoid'
import type { TaskerDB, SubtaskRow } from '@/db/schema'
import type { Subtask, Result } from '@/types'
import type { CreateSubtask, UpdateSubtask } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    ...row,
    isDone: row.isDone === 1,
    createdAt: fromUnixMs(row.createdAt),
  }
}

export class SubtaskRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getByTaskId(taskId: string): Promise<Result<Subtask[]>> {
    try {
      const rows = await this.#db.subtasks.where('taskId').equals(taskId).toArray()
      return { ok: true, data: rows.map(rowToSubtask) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(data: CreateSubtask): Promise<Result<Subtask>> {
    try {
      const row: SubtaskRow = {
        id: nanoid(10),
        ...data,
        isDone: data.isDone ? 1 : 0,
        createdAt: Date.now(),
      }
      await this.#db.subtasks.add(row)
      return { ok: true, data: rowToSubtask(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async update(id: string, data: UpdateSubtask): Promise<Result<Subtask>> {
    try {
      const existing = await this.#db.subtasks.get(id)
      if (!existing)
        return { ok: false, error: { code: 'NOT_FOUND', message: `Subtask ${id} not found` } }
      const patch: Partial<SubtaskRow> = {}
      if (data.title !== undefined) patch.title = data.title
      if (data.isDone !== undefined) patch.isDone = data.isDone ? 1 : 0
      if (data.order !== undefined) patch.order = data.order
      await this.#db.subtasks.update(id, patch)
      return { ok: true, data: rowToSubtask({ ...existing, ...patch }) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.#db.subtasks.delete(id)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

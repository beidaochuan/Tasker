import { nanoid } from 'nanoid'
import type { TaskerDB, TaskCompletionRow } from '@/db/schema'
import type { TaskCompletion, Result } from '@/types'
import { fromUnixMs } from '@/utils/dateUtils'

function rowToCompletion(row: TaskCompletionRow): TaskCompletion {
  return {
    ...row,
    completedAt: fromUnixMs(row.completedAt),
  }
}

export class TaskCompletionRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getByTaskId(taskId: string): Promise<Result<TaskCompletion[]>> {
    try {
      const rows = await this.#db.task_completions.where('taskId').equals(taskId).toArray()
      return { ok: true, data: rows.map(rowToCompletion) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(taskId: string): Promise<Result<TaskCompletion>> {
    try {
      const row: TaskCompletionRow = {
        id: nanoid(10),
        taskId,
        completedAt: Date.now(),
      }
      await this.#db.task_completions.add(row)
      return { ok: true, data: rowToCompletion(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

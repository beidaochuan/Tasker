import { nanoid } from 'nanoid'
import type { TaskerDB } from '@/db/schema'
import type { Tag, Result } from '@/types'
import type { CreateTag } from './interface'

export class TagRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getAll(): Promise<Result<Tag[]>> {
    try {
      const rows = await this.#db.tags.toArray()
      return { ok: true, data: rows }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(data: CreateTag): Promise<Result<Tag>> {
    try {
      const tag: Tag = { id: nanoid(10), ...data }
      await this.#db.tags.add(tag)
      return { ok: true, data: tag }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.#db.tags.delete(id)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

import { nanoid } from 'nanoid'
import type { TaskerDB, TopicRow } from '@/db/schema'
import type { Topic, Result } from '@/types'
import type { CreateTopic, UpdateTopic } from './interface'
import { fromUnixMs } from '@/utils/dateUtils'

function rowToTopic(row: TopicRow): Topic {
  return {
    ...row,
    createdAt: fromUnixMs(row.createdAt),
  }
}

export class TopicRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getByProjectId(projectId: string): Promise<Result<Topic[]>> {
    try {
      const rows = await this.#db.topics.where('projectId').equals(projectId).toArray()
      return { ok: true, data: rows.map(rowToTopic) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async getById(id: string): Promise<Result<Topic>> {
    try {
      const row = await this.#db.topics.get(id)
      if (!row) return { ok: false, error: { code: 'NOT_FOUND', message: `Topic ${id} not found` } }
      return { ok: true, data: rowToTopic(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(data: CreateTopic): Promise<Result<Topic>> {
    try {
      const row: TopicRow = {
        id: nanoid(10),
        ...data,
        createdAt: Date.now(),
      }
      await this.#db.topics.add(row)
      return { ok: true, data: rowToTopic(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async update(id: string, data: UpdateTopic): Promise<Result<Topic>> {
    try {
      const existing = await this.#db.topics.get(id)
      if (!existing)
        return { ok: false, error: { code: 'NOT_FOUND', message: `Topic ${id} not found` } }
      const patch = data as Partial<TopicRow>
      await this.#db.topics.update(id, patch)
      return { ok: true, data: rowToTopic({ ...existing, ...patch }) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.#db.topics.delete(id)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async getIdsByProjectId(projectId: string): Promise<string[]> {
    const rows = await this.#db.topics.where('projectId').equals(projectId).primaryKeys()
    return rows as string[]
  }

  async deleteByProjectId(projectId: string): Promise<Result<void>> {
    try {
      await this.#db.topics.where('projectId').equals(projectId).delete()
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

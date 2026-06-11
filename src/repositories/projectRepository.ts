import { nanoid } from 'nanoid'
import type { TaskerDB, ProjectRow } from '@/db/schema'
import type { Project, Result } from '@/types'
import type { CreateProject, UpdateProject } from './interface'

export function rowToProject(row: ProjectRow): Project {
  return {
    ...row,
    isArchived: Boolean(row.isArchived),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

export class ProjectRepository {
  #db: TaskerDB
  constructor(db: TaskerDB) {
    this.#db = db
  }

  async getAll(): Promise<Result<Project[]>> {
    try {
      const rows = await this.#db.projects.toArray()
      return { ok: true, data: rows.map(rowToProject) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async getById(id: string): Promise<Result<Project>> {
    try {
      const row = await this.#db.projects.get(id)
      if (!row)
        return { ok: false, error: { code: 'NOT_FOUND', message: `Project ${id} not found` } }
      return { ok: true, data: rowToProject(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async create(data: CreateProject): Promise<Result<Project>> {
    try {
      const now = Date.now()
      const row: ProjectRow = {
        id: nanoid(10),
        ...data,
        isArchived: data.isArchived ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      }
      await this.#db.projects.add(row)
      return { ok: true, data: rowToProject(row) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async update(id: string, data: UpdateProject): Promise<Result<Project>> {
    try {
      const existing = await this.#db.projects.get(id)
      if (!existing)
        return { ok: false, error: { code: 'NOT_FOUND', message: `Project ${id} not found` } }

      const patch: Partial<ProjectRow> = { updatedAt: Date.now() }
      if (data.name !== undefined) patch.name = data.name
      if (data.description !== undefined) patch.description = data.description
      if (data.color !== undefined) patch.color = data.color
      if (data.status !== undefined) patch.status = data.status
      if (data.isArchived !== undefined) patch.isArchived = data.isArchived ? 1 : 0

      await this.#db.projects.update(id, patch)
      return { ok: true, data: rowToProject({ ...existing, ...patch }) }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    try {
      await this.#db.projects.delete(id)
      return { ok: true, data: undefined }
    } catch (e) {
      return { ok: false, error: { code: 'DB_ERROR', message: String(e) } }
    }
  }
}

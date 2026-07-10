import { Router } from 'express'
import { db } from '../db.js'

export const importRouter = Router()

const MAX_ROWS = 100_000
const IMPORT_TABLES = [
  'projects',
  'topics',
  'tasks',
  'subtasks',
  'tags',
  'task_completions',
] as const

importRouter.post('/', (req, res) => {
  const { data } = req.body as {
    data: Record<string, unknown[] | undefined>
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'VALIDATION_ERROR' })
  }

  for (const tbl of IMPORT_TABLES) {
    const rows = data[tbl]
    if (rows !== undefined && !Array.isArray(rows)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', field: tbl })
    }
    if (Array.isArray(rows) && rows.length > MAX_ROWS) {
      return res.status(400).json({ error: 'TOO_LARGE', field: tbl })
    }
  }

  db.transaction(() => {
    db.prepare('DELETE FROM task_completions').run()
    db.prepare('DELETE FROM subtasks').run()
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM topics').run()
    db.prepare('DELETE FROM projects').run()
    db.prepare('DELETE FROM tags').run()

    for (const row of (data.projects ?? []) as Record<string, unknown>[]) {
      db.prepare(
        'INSERT OR REPLACE INTO projects (id, name, description, color, status, isArchived, createdAt, updatedAt) VALUES (@id, @name, @description, @color, @status, @isArchived, @createdAt, @updatedAt)'
      ).run(row)
    }
    for (const row of (data.topics ?? []) as Record<string, unknown>[]) {
      db.prepare(
        'INSERT OR REPLACE INTO topics (id, projectId, name, "order", createdAt) VALUES (@id, @projectId, @name, @order, @createdAt)'
      ).run(row)
    }
    for (const row of (data.tasks ?? []) as Record<string, unknown>[]) {
      const r = {
        ...row,
        ganttOrder: row.ganttOrder ?? null,
        tags: typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags ?? []),
      }
      db.prepare(
        'INSERT OR REPLACE INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @createdAt, @updatedAt)'
      ).run(r)
    }
    for (const row of (data.subtasks ?? []) as Record<string, unknown>[]) {
      db.prepare(
        'INSERT OR REPLACE INTO subtasks (id, taskId, title, isDone, "order", createdAt) VALUES (@id, @taskId, @title, @isDone, @order, @createdAt)'
      ).run(row)
    }
    for (const row of (data.tags ?? []) as Record<string, unknown>[]) {
      db.prepare('INSERT OR REPLACE INTO tags (id, name, color) VALUES (@id, @name, @color)').run(
        row
      )
    }
    for (const row of (data.task_completions ?? []) as Record<string, unknown>[]) {
      db.prepare(
        'INSERT OR REPLACE INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
      ).run(row)
    }
  })()

  res.status(204).send()
})

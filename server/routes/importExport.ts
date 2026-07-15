import { Router } from 'express'
import { db } from '../db.js'
import { importSchema, parseOrRespond } from '../validation.js'

export const importRouter = Router()

importRouter.post('/', (req, res) => {
  const input = parseOrRespond(importSchema, req.body, res)
  if (!input) return
  const { data } = input

  db.transaction(() => {
    db.prepare('DELETE FROM task_completions').run()
    db.prepare('DELETE FROM subtasks').run()
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM topics').run()
    db.prepare('DELETE FROM projects').run()
    db.prepare('DELETE FROM tags').run()

    for (const row of data.projects) {
      db.prepare(
        'INSERT OR REPLACE INTO projects (id, name, description, color, status, isArchived, createdAt, updatedAt) VALUES (@id, @name, @description, @color, @status, @isArchived, @createdAt, @updatedAt)'
      ).run(row)
    }
    for (const row of data.topics) {
      db.prepare(
        'INSERT OR REPLACE INTO topics (id, projectId, name, "order", createdAt) VALUES (@id, @projectId, @name, @order, @createdAt)'
      ).run(row)
    }
    for (const row of data.tasks) {
      const r = {
        ...row,
        ganttOrder: row.ganttOrder ?? null,
        statusChangedAt: row.statusChangedAt ?? row.updatedAt,
        tags: typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags ?? []),
      }
      db.prepare(
        'INSERT OR REPLACE INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @statusChangedAt, @createdAt, @updatedAt)'
      ).run(r)
    }
    for (const row of data.subtasks) {
      db.prepare(
        'INSERT OR REPLACE INTO subtasks (id, taskId, title, isDone, "order", createdAt) VALUES (@id, @taskId, @title, @isDone, @order, @createdAt)'
      ).run(row)
    }
    for (const row of data.tags) {
      db.prepare('INSERT OR REPLACE INTO tags (id, name, color) VALUES (@id, @name, @color)').run(
        row
      )
    }
    for (const row of data.task_completions) {
      db.prepare(
        'INSERT OR REPLACE INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
      ).run(row)
    }
  })()

  res.status(204).send()
})

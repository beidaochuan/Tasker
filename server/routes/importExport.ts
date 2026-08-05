import { Router } from 'express'
import { db } from '../db.js'
import { importSchema, parseOrRespond } from '../validation.js'

export const importRouter = Router()

importRouter.post('/', (req, res) => {
  const input = parseOrRespond(importSchema, req.body, res)
  if (!input) return
  const { data } = input

  const taskIdMap = new Map<string, number>()
  const taskIdKey = (id: string | number) => `${typeof id}:${id}`
  const numericTaskIds = data.tasks
    .map((task) => task.id)
    .filter((id): id is number => typeof id === 'number')
  let nextTaskId = Math.max(0, ...numericTaskIds) + 1
  for (const task of data.tasks) {
    taskIdMap.set(taskIdKey(task.id), typeof task.id === 'number' ? task.id : nextTaskId++)
  }
  const mapTaskId = (id: string | number): number => {
    const mapped = taskIdMap.get(taskIdKey(id))
    if (mapped === undefined) throw new Error(`参照先のタスクIDが見つかりません: ${String(id)}`)
    return mapped
  }

  db.transaction(() => {
    db.prepare('DELETE FROM task_relations').run()
    db.prepare('DELETE FROM task_completions').run()
    db.prepare('DELETE FROM task_comments').run()
    db.prepare('DELETE FROM subtasks').run()
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM topics').run()
    db.prepare('DELETE FROM projects').run()
    db.prepare('DELETE FROM tags').run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tasks'").run()

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
        id: mapTaskId(row.id),
        category: row.category ?? null,
        ganttOrder: row.ganttOrder ?? null,
        statusChangedAt: row.statusChangedAt ?? row.updatedAt,
        tags: typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags ?? []),
      }
      db.prepare(
        'INSERT OR REPLACE INTO tasks (id, topicId, title, description, status, priority, category, dueDate, startDate, "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @category, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @statusChangedAt, @createdAt, @updatedAt)'
      ).run(r)
    }
    for (const row of data.subtasks) {
      db.prepare(
        'INSERT OR REPLACE INTO subtasks (id, taskId, title, isDone, "order", createdAt) VALUES (@id, @taskId, @title, @isDone, @order, @createdAt)'
      ).run({ ...row, taskId: mapTaskId(row.taskId) })
    }
    for (const row of data.tags) {
      db.prepare('INSERT OR REPLACE INTO tags (id, name, color) VALUES (@id, @name, @color)').run(
        row
      )
    }
    for (const row of data.task_completions) {
      db.prepare(
        'INSERT OR REPLACE INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
      ).run({ ...row, taskId: mapTaskId(row.taskId) })
    }
    for (const row of data.task_comments) {
      db.prepare(
        'INSERT OR REPLACE INTO task_comments (id, taskId, body, createdAt, updatedAt) VALUES (@id, @taskId, @body, @createdAt, @updatedAt)'
      ).run({ ...row, taskId: mapTaskId(row.taskId) })
    }
    for (const row of data.task_relations) {
      const [taskId, relatedTaskId] = [mapTaskId(row.taskId), mapTaskId(row.relatedTaskId)].sort(
        (a, b) => a - b
      )
      db.prepare(
        'INSERT OR REPLACE INTO task_relations (taskId, relatedTaskId) VALUES (@taskId, @relatedTaskId)'
      ).run({ taskId, relatedTaskId })
    }
  })()

  res.status(204).send()
})

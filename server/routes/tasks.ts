import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const tasksRouter = Router()

const PATCH_ALLOWED = new Set([
  'title', 'description', 'status', 'priority',
  'dueDate', 'startDate', 'order', 'tags', 'repeatRule', 'updatedAt',
])

tasksRouter.get('/', (req, res) => {
  const { topicId, projectId } = req.query
  if (topicId) {
    const rows = db.prepare('SELECT * FROM tasks WHERE topicId = ? ORDER BY "order" ASC').all(topicId as string)
    return res.json(rows.map(parseTask))
  }
  if (projectId) {
    const rows = db.prepare(
      'SELECT t.* FROM tasks t INNER JOIN topics tp ON t.topicId = tp.id WHERE tp.projectId = ? ORDER BY t."order" ASC'
    ).all(projectId as string)
    return res.json((rows as RawTask[]).map(parseTask))
  }
  const rows = db.prepare('SELECT * FROM tasks ORDER BY "order" ASC').all()
  res.json(rows.map(parseTask))
})

tasksRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as RawTask | undefined
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(parseTask(row))
})

tasksRouter.post('/', (req, res) => {
  const { topicId, title, description = '', status = 'todo', priority = 'medium', dueDate = null, startDate = null, order = 0, tags = [], repeatRule = null } = req.body
  if (!topicId || typeof topicId !== 'string') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'topicId' })
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'title' })
  }
  const now = Date.now()
  const row = {
    id: nanoid(10),
    topicId,
    title: title.trim(),
    description,
    status,
    priority,
    dueDate,
    startDate,
    order,
    tags: JSON.stringify(tags),
    repeatRule,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    'INSERT INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", tags, repeatRule, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @tags, @repeatRule, @createdAt, @updatedAt)'
  ).run(row)
  res.status(201).json(parseTask(row))
})

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as RawTask | undefined
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const patch: Record<string, unknown> = { updatedAt: Date.now() }
  const { title, description, status, priority, dueDate, startDate, order, tags, repeatRule } = req.body
  if (title !== undefined) patch.title = title
  if (description !== undefined) patch.description = description
  if (status !== undefined) patch.status = status
  if (priority !== undefined) patch.priority = priority
  if (dueDate !== undefined) patch.dueDate = dueDate
  if (startDate !== undefined) patch.startDate = startDate
  if (order !== undefined) patch.order = order
  if (tags !== undefined) patch.tags = JSON.stringify(tags)
  if (repeatRule !== undefined) patch.repeatRule = repeatRule

  const sets = Object.keys(patch)
    .filter((k) => PATCH_ALLOWED.has(k))
    .map((k) => `"${k}" = @${k}`)
    .join(', ')
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = @id`).run({ ...patch, id: req.params.id })
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as RawTask
  res.json(parseTask(updated))
})

tasksRouter.delete('/:id', (req, res) => {
  const id = req.params.id
  db.transaction(() => {
    db.prepare('DELETE FROM subtasks WHERE taskId = ?').run(id)
    db.prepare('DELETE FROM task_completions WHERE taskId = ?').run(id)
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  })()
  res.status(204).send()
})

interface RawTask {
  id: string
  topicId: string
  title: string
  description: string
  status: string
  priority: string
  dueDate: number | null
  startDate: number | null
  order: number
  tags: string
  repeatRule: string | null
  createdAt: number
  updatedAt: number
}

function parseTask(row: RawTask) {
  return {
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
  }
}

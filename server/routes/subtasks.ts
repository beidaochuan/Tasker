import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'
import {
  parseOrRespond,
  subtaskCreateSchema,
  subtaskOrderSchema,
  subtaskUpdateSchema,
} from '../validation.js'

export const subtasksRouter = Router()

const PATCH_ALLOWED = new Set(['title', 'isDone', 'order'])

subtasksRouter.get('/', (req, res) => {
  const { taskId } = req.query
  if (taskId) {
    const rows = db
      .prepare('SELECT * FROM subtasks WHERE taskId = ? ORDER BY "order" ASC')
      .all(taskId as string)
    return res.json(rows)
  }
  const rows = db.prepare('SELECT * FROM subtasks ORDER BY "order" ASC').all()
  res.json(rows)
})

subtasksRouter.post('/', (req, res) => {
  const input = parseOrRespond(subtaskCreateSchema, req.body, res)
  if (!input) return
  const { taskId, title, isDone, order } = input
  const now = Date.now()
  const row = {
    id: nanoid(10),
    taskId,
    title: title.trim(),
    isDone: isDone ? 1 : 0,
    order,
    createdAt: now,
  }
  db.prepare(
    'INSERT INTO subtasks (id, taskId, title, isDone, "order", createdAt) VALUES (@id, @taskId, @title, @isDone, @order, @createdAt)'
  ).run(row)
  res.status(201).json(row)
})

subtasksRouter.patch('/order', (req, res) => {
  const input = parseOrRespond(subtaskOrderSchema, req.body, res)
  if (!input) return

  const placeholders = input.items.map(() => '?').join(', ')
  const subtasks = db
    .prepare(`SELECT id, taskId FROM subtasks WHERE id IN (${placeholders})`)
    .all(...input.items.map((item) => item.id)) as Array<{ id: string; taskId: string }>
  if (subtasks.length !== input.items.length) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }
  if (new Set(subtasks.map((subtask) => subtask.taskId)).size !== 1) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'items' })
  }
  const taskId = subtasks[0].taskId
  const total = db
    .prepare('SELECT COUNT(*) AS count FROM subtasks WHERE taskId = ?')
    .get(taskId) as { count: number }
  const expectedOrders = new Set(input.items.map((item) => item.order))
  if (
    total.count !== input.items.length ||
    expectedOrders.size !== input.items.length ||
    Array.from(expectedOrders).some((order) => order < 0 || order >= input.items.length)
  ) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'items' })
  }

  const update = db.prepare('UPDATE subtasks SET "order" = ? WHERE id = ?')
  db.transaction(() => {
    for (const item of input.items) update.run(item.order, item.id)
  })()

  res.status(204).send()
})

subtasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(subtaskUpdateSchema, req.body, res)
  if (!input) return
  const { title, isDone, order } = input
  const patch: Record<string, unknown> = {}
  if (title !== undefined) patch.title = title
  if (isDone !== undefined) patch.isDone = isDone ? 1 : 0
  if (order !== undefined) patch.order = order

  if (Object.keys(patch).length > 0) {
    const sets = Object.keys(patch)
      .filter((k) => PATCH_ALLOWED.has(k))
      .map((k) => `"${k}" = @${k}`)
      .join(', ')
    if (sets) {
      db.prepare(`UPDATE subtasks SET ${sets} WHERE id = @id`).run({ ...patch, id: req.params.id })
    }
  }
  const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id)
  res.json(updated)
})

subtasksRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

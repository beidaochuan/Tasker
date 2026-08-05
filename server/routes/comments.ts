import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'
import { commentCreateSchema, commentUpdateSchema, parseOrRespond } from '../validation.js'

export const commentsRouter = Router()

const PATCH_ALLOWED = new Set(['body', 'updatedAt'])

commentsRouter.get('/', (req, res) => {
  const { taskId } = req.query
  if (taskId) {
    const rows = db
      .prepare('SELECT * FROM task_comments WHERE taskId = ? ORDER BY createdAt DESC')
      .all(taskId as string)
    return res.json(rows)
  }
  const rows = db.prepare('SELECT * FROM task_comments ORDER BY createdAt DESC').all()
  res.json(rows)
})

commentsRouter.post('/', (req, res) => {
  const input = parseOrRespond(commentCreateSchema, req.body, res)
  if (!input) return
  const { taskId, body } = input
  const now = Date.now()
  const row = {
    id: nanoid(10),
    taskId,
    body,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    'INSERT INTO task_comments (id, taskId, body, createdAt, updatedAt) VALUES (@id, @taskId, @body, @createdAt, @updatedAt)'
  ).run(row)
  res.status(201).json(row)
})

commentsRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(commentUpdateSchema, req.body, res)
  if (!input) return
  const { body } = input
  const patch: Record<string, unknown> = { updatedAt: Date.now() }
  if (body !== undefined) patch.body = body

  const sets = Object.keys(patch)
    .filter((k) => PATCH_ALLOWED.has(k))
    .map((k) => `"${k}" = @${k}`)
    .join(', ')
  db.prepare(`UPDATE task_comments SET ${sets} WHERE id = @id`).run({
    ...patch,
    id: req.params.id,
  })
  const updated = db.prepare('SELECT * FROM task_comments WHERE id = ?').get(req.params.id)
  res.json(updated)
})

commentsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM task_comments WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

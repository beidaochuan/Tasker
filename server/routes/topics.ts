import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const topicsRouter = Router()

const PATCH_ALLOWED = new Set(['name', 'order'])

topicsRouter.get('/', (req, res) => {
  const { projectId } = req.query
  if (projectId) {
    const rows = db.prepare('SELECT * FROM topics WHERE projectId = ? ORDER BY "order" ASC').all(projectId as string)
    return res.json(rows)
  }
  const rows = db.prepare('SELECT * FROM topics ORDER BY "order" ASC').all()
  res.json(rows)
})

topicsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(row)
})

topicsRouter.post('/', (req, res) => {
  const { projectId, name, order = 0 } = req.body
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'projectId' })
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'name' })
  }
  const now = Date.now()
  const row = { id: nanoid(10), projectId, name: name.trim(), order, createdAt: now }
  db.prepare(
    'INSERT INTO topics (id, projectId, name, "order", createdAt) VALUES (@id, @projectId, @name, @order, @createdAt)'
  ).run(row)
  res.status(201).json(row)
})

topicsRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const { name, order } = req.body
  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (order !== undefined) patch.order = order

  if (Object.keys(patch).length > 0) {
    const sets = Object.keys(patch)
      .filter((k) => PATCH_ALLOWED.has(k))
      .map((k) => `"${k}" = @${k}`)
      .join(', ')
    if (sets) {
      db.prepare(`UPDATE topics SET ${sets} WHERE id = @id`).run({ ...patch, id: req.params.id })
    }
  }
  const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id)
  res.json(updated)
})

topicsRouter.delete('/:id', (req, res) => {
  const id = req.params.id
  db.transaction(() => {
    const taskIds = (db.prepare('SELECT id FROM tasks WHERE topicId = ?').all(id) as { id: string }[]).map((r) => r.id)
    if (taskIds.length > 0) {
      const tp = taskIds.map(() => '?').join(',')
      db.prepare(`DELETE FROM subtasks WHERE taskId IN (${tp})`).run(...taskIds)
      db.prepare(`DELETE FROM task_completions WHERE taskId IN (${tp})`).run(...taskIds)
      db.prepare(`DELETE FROM tasks WHERE id IN (${tp})`).run(...taskIds)
    }
    db.prepare('DELETE FROM topics WHERE id = ?').run(id)
  })()
  res.status(204).send()
})

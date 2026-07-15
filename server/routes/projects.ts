import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'
import { parseOrRespond, projectCreateSchema, projectUpdateSchema } from '../validation.js'

export const projectsRouter = Router()

const PATCH_ALLOWED = new Set(['name', 'description', 'color', 'status', 'isArchived', 'updatedAt'])

projectsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY createdAt ASC').all()
  res.json(rows)
})

projectsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(row)
})

projectsRouter.post('/', (req, res) => {
  const input = parseOrRespond(projectCreateSchema, req.body, res)
  if (!input) return
  const { name, description, color, status, isArchived } = input
  const now = Date.now()
  const row = {
    id: nanoid(10),
    name: name.trim(),
    description,
    color,
    status,
    isArchived: isArchived ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    'INSERT INTO projects (id, name, description, color, status, isArchived, createdAt, updatedAt) VALUES (@id, @name, @description, @color, @status, @isArchived, @createdAt, @updatedAt)'
  ).run(row)
  res.status(201).json(row)
})

projectsRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(projectUpdateSchema, req.body, res)
  if (!input) return
  const { name, description, color, status, isArchived } = input
  const patch: Record<string, unknown> = { updatedAt: Date.now() }
  if (name !== undefined) patch.name = name
  if (description !== undefined) patch.description = description
  if (color !== undefined) patch.color = color
  if (status !== undefined) patch.status = status
  if (isArchived !== undefined) patch.isArchived = isArchived ? 1 : 0

  const sets = Object.keys(patch)
    .filter((k) => PATCH_ALLOWED.has(k))
    .map((k) => `"${k}" = @${k}`)
    .join(', ')
  db.prepare(`UPDATE projects SET ${sets} WHERE id = @id`).run({ ...patch, id: req.params.id })
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json(updated)
})

projectsRouter.delete('/:id', (req, res) => {
  const id = req.params.id
  db.transaction(() => {
    const topicIds = (
      db.prepare('SELECT id FROM topics WHERE projectId = ?').all(id) as { id: string }[]
    ).map((r) => r.id)
    if (topicIds.length > 0) {
      const placeholders = topicIds.map(() => '?').join(',')
      const taskIds = (
        db.prepare(`SELECT id FROM tasks WHERE topicId IN (${placeholders})`).all(...topicIds) as {
          id: string
        }[]
      ).map((r) => r.id)
      if (taskIds.length > 0) {
        const tp = taskIds.map(() => '?').join(',')
        db.prepare(`DELETE FROM subtasks WHERE taskId IN (${tp})`).run(...taskIds)
        db.prepare(`DELETE FROM task_completions WHERE taskId IN (${tp})`).run(...taskIds)
        db.prepare(`DELETE FROM tasks WHERE id IN (${tp})`).run(...taskIds)
      }
      db.prepare(`DELETE FROM topics WHERE id IN (${placeholders})`).run(...topicIds)
    }
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  })()
  res.status(204).send()
})

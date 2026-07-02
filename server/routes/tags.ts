import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const tagsRouter = Router()

tagsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM tags ORDER BY name ASC').all()
  res.json(rows)
})

tagsRouter.post('/', (req, res) => {
  const { name, color = '#6366f1' } = req.body
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'name' })
  }
  const row = { id: nanoid(10), name: name.trim(), color }
  try {
    db.prepare('INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)').run(row)
    res.status(201).json(row)
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'DUPLICATE' })
    }
    throw e
  }
})

tagsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

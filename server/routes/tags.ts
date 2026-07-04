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
  const id = req.params.id
  db.transaction(() => {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)

    const tasks = db.prepare('SELECT id, tags FROM tasks').all() as { id: string; tags: string }[]
    const updateTaskTags = db.prepare('UPDATE tasks SET tags = ?, updatedAt = ? WHERE id = ?')
    const now = Date.now()

    for (const task of tasks) {
      const tags = parseTags(task.tags)
      if (!tags.includes(id)) continue
      updateTaskTags.run(JSON.stringify(tags.filter((tagId) => tagId !== id)), now, task.id)
    }
  })()
  res.status(204).send()
})

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : []
  } catch {
    return []
  }
}

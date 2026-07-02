import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const completionsRouter = Router()

completionsRouter.get('/', (req, res) => {
  const { taskId } = req.query
  if (taskId) {
    const rows = db.prepare('SELECT * FROM task_completions WHERE taskId = ? ORDER BY completedAt DESC').all(taskId as string)
    return res.json(rows)
  }
  const rows = db.prepare('SELECT * FROM task_completions ORDER BY completedAt DESC').all()
  res.json(rows)
})

completionsRouter.post('/', (req, res) => {
  const { taskId } = req.body
  const row = { id: nanoid(10), taskId, completedAt: Date.now() }
  db.prepare('INSERT INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)').run(row)
  res.status(201).json(row)
})

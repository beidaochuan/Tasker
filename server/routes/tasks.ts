import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'

export const tasksRouter = Router()

const PATCH_ALLOWED = new Set([
  'topicId',
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
  'startDate',
  'order',
  'ganttOrder',
  'tags',
  'repeatRule',
  'updatedAt',
])

tasksRouter.get('/', (req, res) => {
  const { topicId, projectId } = req.query
  if (topicId) {
    const rows = db
      .prepare('SELECT * FROM tasks WHERE topicId = ? ORDER BY "order" ASC')
      .all(topicId as string) as RawTask[]
    return res.json(rows.map(parseTask))
  }
  if (projectId) {
    const rows = db
      .prepare(
        'SELECT t.* FROM tasks t INNER JOIN topics tp ON t.topicId = tp.id WHERE tp.projectId = ? ORDER BY t."order" ASC'
      )
      .all(projectId as string)
    return res.json((rows as RawTask[]).map(parseTask))
  }
  const rows = db.prepare('SELECT * FROM tasks ORDER BY "order" ASC').all() as RawTask[]
  res.json(rows.map(parseTask))
})

tasksRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | RawTask
    | undefined
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(parseTask(row))
})

tasksRouter.post('/:id/complete-recurring', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | RawTask
    | undefined
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const nextTask = normalizeNextTask(req.body?.nextTask, existing)
  const completedAt = Date.now()
  const completion = { id: nanoid(10), taskId: existing.id, completedAt }

  const result = db.transaction(() => {
    const targetTopicId = nextTask?.topicId ?? existing.topicId
    db.prepare('UPDATE tasks SET topicId = ?, status = ?, updatedAt = ? WHERE id = ?').run(
      targetTopicId,
      'done',
      completedAt,
      existing.id
    )
    db.prepare(
      'INSERT INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
    ).run(completion)

    let createdNextTask: RawTask | null = null
    if (nextTask) {
      createdNextTask = {
        id: nanoid(10),
        topicId: targetTopicId,
        title: nextTask.title,
        description: nextTask.description,
        status: 'todo',
        priority: nextTask.priority,
        dueDate: nextTask.dueDate,
        startDate: nextTask.startDate,
        order: nextTask.order,
        ganttOrder: null,
        tags: JSON.stringify(nextTask.tags),
        repeatRule: nextTask.repeatRule,
        createdAt: completedAt,
        updatedAt: completedAt,
      }
      db.prepare(
        'INSERT INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @createdAt, @updatedAt)'
      ).run(createdNextTask)
    }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id) as RawTask
    return {
      task: parseTask(updatedTask),
      completion,
      nextTask: createdNextTask ? parseTask(createdNextTask) : null,
    }
  })()

  res.status(201).json(result)
})

tasksRouter.post('/', (req, res) => {
  const {
    topicId,
    title,
    description = '',
    status = 'todo',
    priority = 'medium',
    dueDate = null,
    startDate = null,
    order = 0,
    ganttOrder = null,
    tags = [],
    repeatRule = null,
  } = req.body
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
    ganttOrder,
    tags: JSON.stringify(tags),
    repeatRule,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    'INSERT INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @createdAt, @updatedAt)'
  ).run(row)
  res.status(201).json(parseTask(row))
})

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | RawTask
    | undefined
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const patch: Record<string, unknown> = { updatedAt: Date.now() }
  const {
    topicId,
    title,
    description,
    status,
    priority,
    dueDate,
    startDate,
    order,
    ganttOrder,
    tags,
    repeatRule,
  } = req.body
  if (topicId !== undefined) patch.topicId = topicId
  if (title !== undefined) patch.title = title
  if (description !== undefined) patch.description = description
  if (status !== undefined) patch.status = status
  if (priority !== undefined) patch.priority = priority
  if (dueDate !== undefined) patch.dueDate = dueDate
  if (startDate !== undefined) patch.startDate = startDate
  if (order !== undefined) patch.order = order
  if (ganttOrder !== undefined) patch.ganttOrder = ganttOrder
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
  ganttOrder: number | null
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

interface NextTaskInput {
  topicId: string
  title: string
  description: string
  priority: string
  dueDate: number | null
  startDate: number | null
  order: number
  tags: string[]
  repeatRule: string | null
}

function normalizeNextTask(value: unknown, existing: RawTask): NextTaskInput | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const topicId =
    typeof input.topicId === 'string' && input.topicId !== '' ? input.topicId : existing.topicId
  const title =
    typeof input.title === 'string' && input.title.trim() !== ''
      ? input.title.trim()
      : existing.title
  const description =
    typeof input.description === 'string' ? input.description : existing.description
  const priority = typeof input.priority === 'string' ? input.priority : existing.priority
  const dueDate = typeof input.dueDate === 'number' || input.dueDate === null ? input.dueDate : null
  const startDate =
    typeof input.startDate === 'number' || input.startDate === null ? input.startDate : null
  const order = typeof input.order === 'number' ? input.order : 9999
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((tag): tag is string => typeof tag === 'string')
    : parseTags(existing.tags)
  const repeatRule =
    typeof input.repeatRule === 'string' || input.repeatRule === null
      ? input.repeatRule
      : existing.repeatRule

  return { topicId, title, description, priority, dueDate, startDate, order, tags, repeatRule }
}

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

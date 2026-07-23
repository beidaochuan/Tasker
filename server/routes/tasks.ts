import { Router } from 'express'
import { nanoid } from 'nanoid'
import { db } from '../db.js'
import { deleteTaskHierarchy } from '../services/deleteHierarchy.js'
import { decodeTaskTags, encodeTaskTags, taskRowToApi, type TaskRow } from '../taskRecord.js'
import {
  completeRecurringSchema,
  ganttOrderSchema,
  parseOrRespond,
  taskCreateSchema,
  taskRelationsSchema,
  taskUpdateSchema,
} from '../validation.js'

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
  'statusChangedAt',
  'updatedAt',
])

tasksRouter.get('/', (req, res) => {
  const { topicId, projectId } = req.query
  if (topicId) {
    const rows = db
      .prepare('SELECT * FROM tasks WHERE topicId = ? ORDER BY "order" ASC')
      .all(topicId as string) as TaskRow[]
    return res.json(rows.map(taskRowToApi))
  }
  if (projectId) {
    const rows = db
      .prepare(
        'SELECT t.* FROM tasks t INNER JOIN topics tp ON t.topicId = tp.id WHERE tp.projectId = ? ORDER BY t."order" ASC'
      )
      .all(projectId as string)
    return res.json((rows as TaskRow[]).map(taskRowToApi))
  }
  const rows = db.prepare('SELECT * FROM tasks ORDER BY "order" ASC').all() as TaskRow[]
  res.json(rows.map(taskRowToApi))
})

tasksRouter.get('/relations', (_req, res) => {
  const relations = db
    .prepare(
      'SELECT taskId, relatedTaskId FROM task_relations ORDER BY taskId ASC, relatedTaskId ASC'
    )
    .all()
  res.json(relations)
})

tasksRouter.get('/:id/related-tasks', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(req.params.id)
  if (!exists) return res.status(404).json({ error: 'NOT_FOUND' })

  const rows = db
    .prepare(
      `SELECT t.*
       FROM task_relations r
       INNER JOIN tasks t ON t.id = CASE
         WHEN r.taskId = @taskId THEN r.relatedTaskId
         ELSE r.taskId
       END
       WHERE r.taskId = @taskId OR r.relatedTaskId = @taskId
       ORDER BY t.title COLLATE NOCASE ASC, t.id ASC`
    )
    .all({ taskId: req.params.id }) as TaskRow[]
  res.json(rows.map(taskRowToApi))
})

tasksRouter.put('/:id/related-tasks', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(req.params.id)
  if (!exists) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(taskRelationsSchema, req.body, res)
  if (!input) return
  if (input.relatedTaskIds.includes(req.params.id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'relatedTaskIds' })
  }

  if (input.relatedTaskIds.length > 0) {
    const placeholders = input.relatedTaskIds.map(() => '?').join(', ')
    const found = db
      .prepare(`SELECT id FROM tasks WHERE id IN (${placeholders})`)
      .all(...input.relatedTaskIds) as Array<{ id: string }>
    if (found.length !== input.relatedTaskIds.length) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
  }

  const saveRelations = db.transaction(() => {
    db.prepare('DELETE FROM task_relations WHERE taskId = ? OR relatedTaskId = ?').run(
      req.params.id,
      req.params.id
    )
    const insert = db.prepare('INSERT INTO task_relations (taskId, relatedTaskId) VALUES (?, ?)')
    for (const relatedTaskId of input.relatedTaskIds) {
      const [taskId, otherTaskId] = [req.params.id, relatedTaskId].sort()
      insert.run(taskId, otherTaskId)
    }
    return db
      .prepare(
        `SELECT t.*
         FROM task_relations r
         INNER JOIN tasks t ON t.id = CASE
           WHEN r.taskId = @taskId THEN r.relatedTaskId
           ELSE r.taskId
         END
         WHERE r.taskId = @taskId OR r.relatedTaskId = @taskId
         ORDER BY t.title COLLATE NOCASE ASC, t.id ASC`
      )
      .all({ taskId: req.params.id }) as TaskRow[]
  })()

  res.json(saveRelations.map(taskRowToApi))
})

tasksRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | TaskRow
    | undefined
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
  res.json(taskRowToApi(row))
})

tasksRouter.post('/:id/complete-recurring', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | TaskRow
    | undefined
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(completeRecurringSchema, req.body, res)
  if (!input) return
  const nextTask = normalizeNextTask(input.nextTask, existing)
  const completedAt = Date.now()
  const completion = { id: nanoid(10), taskId: existing.id, completedAt }

  const result = db.transaction(() => {
    const targetTopicId = nextTask?.topicId ?? existing.topicId
    const targetGanttOrder = targetTopicId === existing.topicId ? existing.ganttOrder : null
    db.prepare(
      'UPDATE tasks SET topicId = ?, status = ?, ganttOrder = ?, statusChangedAt = ?, updatedAt = ? WHERE id = ?'
    ).run(targetTopicId, 'done', targetGanttOrder, completedAt, completedAt, existing.id)
    db.prepare(
      'INSERT INTO task_completions (id, taskId, completedAt) VALUES (@id, @taskId, @completedAt)'
    ).run(completion)

    let createdNextTask: TaskRow | null = null
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
        tags: encodeTaskTags(nextTask.tags),
        repeatRule: nextTask.repeatRule,
        statusChangedAt: completedAt,
        createdAt: completedAt,
        updatedAt: completedAt,
      }
      db.prepare(
        'INSERT INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @statusChangedAt, @createdAt, @updatedAt)'
      ).run(createdNextTask)
    }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id) as TaskRow
    return {
      task: taskRowToApi(updatedTask),
      completion,
      nextTask: createdNextTask ? taskRowToApi(createdNextTask) : null,
    }
  })()

  res.status(201).json(result)
})

tasksRouter.post('/', (req, res) => {
  const input = parseOrRespond(taskCreateSchema, req.body, res)
  if (!input) return
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
  } = input
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
    tags: encodeTaskTags(tags),
    repeatRule,
    statusChangedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    'INSERT INTO tasks (id, topicId, title, description, status, priority, dueDate, startDate, "order", ganttOrder, tags, repeatRule, statusChangedAt, createdAt, updatedAt) VALUES (@id, @topicId, @title, @description, @status, @priority, @dueDate, @startDate, @order, @ganttOrder, @tags, @repeatRule, @statusChangedAt, @createdAt, @updatedAt)'
  ).run(row)
  res.status(201).json(taskRowToApi(row))
})

tasksRouter.patch('/gantt-order', (req, res) => {
  const input = parseOrRespond(ganttOrderSchema, req.body, res)
  if (!input) return
  const updates = input.items

  const placeholders = updates.map(() => '?').join(', ')
  const tasks = db
    .prepare(`SELECT id, topicId FROM tasks WHERE id IN (${placeholders})`)
    .all(...updates.map((item) => item.id)) as Array<{ id: string; topicId: string }>
  if (tasks.length !== updates.length) {
    return res.status(404).json({ error: 'NOT_FOUND' })
  }
  if (new Set(tasks.map((task) => task.topicId)).size !== 1) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'items' })
  }

  const update = db.prepare('UPDATE tasks SET ganttOrder = ?, updatedAt = ? WHERE id = ?')
  const updatedAt = Date.now()
  db.transaction(() => {
    for (const item of updates) update.run(item.ganttOrder, updatedAt, item.id)
  })()

  res.status(204).send()
})

tasksRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
    | TaskRow
    | undefined
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' })

  const input = parseOrRespond(taskUpdateSchema, req.body, res)
  if (!input) return

  const now = Date.now()
  const patch: Record<string, unknown> = { updatedAt: now }
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
  } = input
  const topicChanged = topicId !== undefined && topicId !== existing.topicId
  if (topicId !== undefined) patch.topicId = topicId
  if (title !== undefined) patch.title = title
  if (description !== undefined) patch.description = description
  if (status !== undefined) {
    patch.status = status
    if (status !== existing.status) patch.statusChangedAt = now
  }
  if (priority !== undefined) patch.priority = priority
  if (dueDate !== undefined) patch.dueDate = dueDate
  if (startDate !== undefined) patch.startDate = startDate
  if (order !== undefined) patch.order = order
  if (topicChanged) patch.ganttOrder = null
  else if (ganttOrder !== undefined) patch.ganttOrder = ganttOrder
  if (tags !== undefined) patch.tags = encodeTaskTags(tags)
  if (repeatRule !== undefined) patch.repeatRule = repeatRule

  const sets = Object.keys(patch)
    .filter((k) => PATCH_ALLOWED.has(k))
    .map((k) => `"${k}" = @${k}`)
    .join(', ')
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = @id`).run({ ...patch, id: req.params.id })
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as TaskRow
  res.json(taskRowToApi(updated))
})

tasksRouter.delete('/:id', (req, res) => {
  deleteTaskHierarchy(db, req.params.id)
  res.status(204).send()
})

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

function normalizeNextTask(value: unknown, existing: TaskRow): NextTaskInput | null {
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
    : decodeTaskTags(existing.tags)
  const repeatRule =
    typeof input.repeatRule === 'string' || input.repeatRule === null
      ? input.repeatRule
      : existing.repeatRule

  return { topicId, title, description, priority, dueDate, startDate, order, tags, repeatRule }
}

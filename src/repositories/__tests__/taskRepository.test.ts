import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { TaskerDB } from '@/db/schema'
import { TopicRepository } from '../topicRepository'
import { TaskRepository } from '../taskRepository'
import { ProjectRepository } from '../projectRepository'

let db: TaskerDB
let projectRepo: ProjectRepository
let topicRepo: TopicRepository
let taskRepo: TaskRepository
let topicId: string

beforeEach(async () => {
  db = new TaskerDB(new IDBFactory())
  projectRepo = new ProjectRepository(db)
  topicRepo = new TopicRepository(db)
  taskRepo = new TaskRepository(db)

  const project = await projectRepo.create({
    name: 'P',
    description: '',
    color: '#000',
    status: 'active',
    isArchived: false,
  })
  if (!project.ok) throw new Error('project create failed')
  const topic = await topicRepo.create({ projectId: project.data.id, name: 'T', order: 0 })
  if (!topic.ok) throw new Error('topic create failed')
  topicId = topic.data.id
})

const baseTask = () => ({
  topicId,
  title: 'タスク1',
  description: '',
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: null,
  startDate: null,
  order: 0,
  tags: [],
  repeatRule: null,
})

describe('TaskRepository', () => {
  describe('create', () => {
    it('タスクを作成して返す', async () => {
      const result = await taskRepo.create(baseTask())
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBeDefined()
      expect(result.data.title).toBe('タスク1')
      expect(result.data.createdAt).toBeInstanceOf(Date)
    })

    it('dueDate を Date で保持する', async () => {
      const due = new Date(2024, 5, 15)
      const result = await taskRepo.create({ ...baseTask(), dueDate: due })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.dueDate).toBeInstanceOf(Date)
      expect(result.data.dueDate?.getTime()).toBe(due.getTime())
    })
  })

  describe('getByTopicId', () => {
    it('トピックのタスク一覧を返す', async () => {
      await taskRepo.create(baseTask())
      await taskRepo.create({ ...baseTask(), title: 'タスク2', order: 1 })
      const result = await taskRepo.getByTopicId(topicId)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBe(2)
    })
  })

  describe('update', () => {
    it('ステータスを更新できる', async () => {
      const created = await taskRepo.create(baseTask())
      if (!created.ok) return
      const result = await taskRepo.update(created.data.id, { status: 'done' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.status).toBe('done')
    })
  })

  describe('delete', () => {
    it('タスクを削除できる', async () => {
      const created = await taskRepo.create(baseTask())
      if (!created.ok) return
      await taskRepo.delete(created.data.id)
      const get = await taskRepo.getById(created.data.id)
      expect(get.ok).toBe(false)
    })

    it('タスク削除時にサブタスクと完了履歴も削除する', async () => {
      const created = await taskRepo.create(baseTask())
      if (!created.ok) return
      await db.subtasks.add({
        id: 'sub-1',
        taskId: created.data.id,
        title: 'sub',
        isDone: 0,
        order: 0,
        createdAt: Date.now(),
      })
      await db.task_completions.add({
        id: 'completion-1',
        taskId: created.data.id,
        completedAt: Date.now(),
      })

      const result = await taskRepo.delete(created.data.id)

      expect(result.ok).toBe(true)
      expect(await db.subtasks.where('taskId').equals(created.data.id).count()).toBe(0)
      expect(await db.task_completions.where('taskId').equals(created.data.id).count()).toBe(0)
    })
  })
})

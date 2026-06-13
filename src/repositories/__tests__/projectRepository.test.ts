import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { TaskerDB } from '@/db/schema'
import { ProjectRepository } from '../projectRepository'

let db: TaskerDB
let repo: ProjectRepository

beforeEach(async () => {
  db = new TaskerDB(new IDBFactory())
  repo = new ProjectRepository(db)
})

describe('ProjectRepository', () => {
  describe('create', () => {
    it('プロジェクトを作成して返す', async () => {
      const result = await repo.create({
        name: 'テストプロジェクト',
        description: '',
        color: '#3b82f6',
        status: 'active',
        isArchived: false,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBeDefined()
      expect(result.data.name).toBe('テストプロジェクト')
      expect(result.data.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('getAll', () => {
    it('作成したプロジェクト一覧を返す', async () => {
      await repo.create({
        name: 'A',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      await repo.create({
        name: 'B',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.length).toBe(2)
    })

    it('空なら空配列を返す', async () => {
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual([])
    })
  })

  describe('getById', () => {
    it('存在するIDで取得できる', async () => {
      const created = await repo.create({
        name: 'X',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      if (!created.ok) return
      const result = await repo.getById(created.data.id)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.name).toBe('X')
    })

    it('存在しないIDは NOT_FOUND エラー', async () => {
      const result = await repo.getById('nonexistent')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('update', () => {
    it('フィールドを更新できる', async () => {
      const created = await repo.create({
        name: '旧名',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      if (!created.ok) return
      const result = await repo.update(created.data.id, { name: '新名' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.name).toBe('新名')
    })

    it('存在しないIDは NOT_FOUND エラー', async () => {
      const result = await repo.update('nonexistent', { name: 'X' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('delete', () => {
    it('プロジェクトを削除できる', async () => {
      const created = await repo.create({
        name: 'Del',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      if (!created.ok) return
      const result = await repo.delete(created.data.id)
      expect(result.ok).toBe(true)
      const get = await repo.getById(created.data.id)
      expect(get.ok).toBe(false)
    })

    it('プロジェクト削除時に配下のトピック、タスク、サブタスク、完了履歴も削除する', async () => {
      const created = await repo.create({
        name: 'Cascade',
        description: '',
        color: '#000',
        status: 'active',
        isArchived: false,
      })
      if (!created.ok) return
      await db.topics.add({
        id: 'topic-1',
        projectId: created.data.id,
        name: 'Topic',
        order: 0,
        createdAt: Date.now(),
      })
      await db.tasks.add({
        id: 'task-1',
        topicId: 'topic-1',
        title: 'Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        startDate: null,
        order: 0,
        tags: [],
        repeatRule: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.subtasks.add({
        id: 'sub-1',
        taskId: 'task-1',
        title: 'Sub',
        isDone: 0,
        order: 0,
        createdAt: Date.now(),
      })
      await db.task_completions.add({
        id: 'completion-1',
        taskId: 'task-1',
        completedAt: Date.now(),
      })

      const result = await repo.delete(created.data.id)

      expect(result.ok).toBe(true)
      expect(await db.topics.count()).toBe(0)
      expect(await db.tasks.count()).toBe(0)
      expect(await db.subtasks.count()).toBe(0)
      expect(await db.task_completions.count()).toBe(0)
    })
  })
})

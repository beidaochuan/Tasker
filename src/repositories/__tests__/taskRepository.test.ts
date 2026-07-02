import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiTaskRepository } from '../apiTaskRepository'

const repo = new ApiTaskRepository()

const RAW_TASK = {
  id: 'task-1',
  topicId: 'topic-1',
  title: 'タスク1',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  startDate: null,
  order: 0,
  tags: [] as string[],
  repeatRule: null,
  createdAt: 1_000_000,
  updatedAt: 1_000_000,
}

function mockFetch(body: unknown, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ApiTaskRepository', () => {
  describe('create', () => {
    it('タスクを作成して返す', async () => {
      mockFetch(RAW_TASK, 201)
      const result = await repo.create({
        topicId: 'topic-1',
        title: 'タスク1',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        startDate: null,
        order: 0,
        tags: [],
        repeatRule: null,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBe('task-1')
      expect(result.data.title).toBe('タスク1')
      expect(result.data.createdAt).toBeInstanceOf(Date)
    })

    it('dueDate を Date で保持する', async () => {
      const due = new Date(2024, 5, 15)
      mockFetch({ ...RAW_TASK, dueDate: due.getTime() }, 201)
      const result = await repo.create({
        topicId: 'topic-1',
        title: 'タスク1',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: due,
        startDate: null,
        order: 0,
        tags: [],
        repeatRule: null,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.dueDate).toBeInstanceOf(Date)
      expect(result.data.dueDate?.getTime()).toBe(due.getTime())
    })
  })

  describe('getByTopicId', () => {
    it('トピックのタスク一覧を返す', async () => {
      mockFetch([RAW_TASK, { ...RAW_TASK, id: 'task-2', title: 'タスク2', order: 1 }])
      const result = await repo.getByTopicId('topic-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(2)
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks?topicId=topic-1', undefined)
    })
  })

  describe('update', () => {
    it('ステータスを更新できる', async () => {
      mockFetch({ ...RAW_TASK, status: 'done' })
      const result = await repo.update('task-1', { status: 'done' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.status).toBe('done')
    })
  })

  describe('delete', () => {
    it('タスクを削除できる (サーバー側でサブタスク・完了履歴も削除)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)
      const result = await repo.delete('task-1')
      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/task-1', { method: 'DELETE' })
    })
  })
})

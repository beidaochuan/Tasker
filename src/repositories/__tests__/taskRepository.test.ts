import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
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
  useAuthStore.setState({ isAuthenticated: true, csrfToken: null })
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
      expect(result.data.statusChangedAt).toEqual(new Date(RAW_TASK.updatedAt))
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
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks?topicId=topic-1', {
        credentials: 'same-origin',
      })
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

  describe('updateGanttOrder', () => {
    it('ガント順序を一括更新する', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)
      const items = [
        { id: 'task-2', ganttOrder: 0 },
        { id: 'task-1', ganttOrder: 1 },
      ]

      const result = await repo.updateGanttOrder(items)

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/gantt-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        credentials: 'same-origin',
      })
    })
  })

  describe('completeRecurring', () => {
    it('完了履歴と次回タスクを返す', async () => {
      const due = new Date(2024, 5, 16)
      const nextTask = {
        ...RAW_TASK,
        id: 'task-next',
        status: 'todo',
        dueDate: due.getTime(),
        repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1',
      }
      mockFetch(
        {
          task: { ...RAW_TASK, status: 'done' },
          completion: { id: 'completion-1', taskId: 'task-1', completedAt: 1_100_000 },
          nextTask,
        },
        201
      )

      const result = await repo.completeRecurring('task-1', {
        topicId: 'topic-1',
        title: 'タスク1',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: due,
        startDate: null,
        order: 9999,
        tags: [],
        repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.task.status).toBe('done')
      expect(result.data.completion.completedAt).toBeInstanceOf(Date)
      expect(result.data.nextTask?.id).toBe('task-next')
      expect(result.data.nextTask?.dueDate?.getTime()).toBe(due.getTime())
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/task-1/complete-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextTask: {
            topicId: 'topic-1',
            title: 'タスク1',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: due.getTime(),
            startDate: null,
            order: 9999,
            tags: [],
            repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1',
          },
        }),
        credentials: 'same-origin',
      })
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
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/task-1', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    })
  })
})

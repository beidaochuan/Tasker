import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ApiSubtaskRepository } from '../apiSubtaskRepository'

const repo = new ApiSubtaskRepository()

const RAW_SUBTASK = {
  id: 'subtask-1',
  taskId: 'task-1',
  title: '作業1',
  isDone: 0,
  order: 0,
  createdAt: 1_000_000,
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

describe('ApiSubtaskRepository', () => {
  describe('getByTaskId', () => {
    it('taskId を URL エンコードし、API の並び順を保って型変換する', async () => {
      mockFetch([
        RAW_SUBTASK,
        {
          ...RAW_SUBTASK,
          id: 'subtask-2',
          title: '作業2',
          isDone: 1,
          order: 1,
          createdAt: 2_000_000,
        },
      ])

      const result = await repo.getByTaskId('task/1 ?')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.map((subtask) => subtask.id)).toEqual(['subtask-1', 'subtask-2'])
      expect(result.data[0].isDone).toBe(false)
      expect(result.data[1].isDone).toBe(true)
      expect(result.data[0].createdAt).toBeInstanceOf(Date)
      expect(result.data[0].createdAt.getTime()).toBe(1_000_000)
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks?taskId=task%2F1%20%3F', {
        credentials: 'same-origin',
      })
    })
  })

  describe('create', () => {
    it('作業項目を作成して返す', async () => {
      mockFetch(RAW_SUBTASK, 201)

      const result = await repo.create({
        taskId: 'task-1',
        title: '作業1',
        isDone: false,
        order: 0,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'subtask-1',
          taskId: 'task-1',
          title: '作業1',
          isDone: false,
          order: 0,
        })
      )
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'task-1',
          title: '作業1',
          isDone: false,
          order: 0,
        }),
        credentials: 'same-origin',
      })
    })
  })

  describe('update', () => {
    it('チェック状態を完了へ更新する', async () => {
      mockFetch({ ...RAW_SUBTASK, isDone: 1 })

      const result = await repo.update('subtask-1', { isDone: true })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.isDone).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks/subtask-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: true }),
        credentials: 'same-origin',
      })
    })

    it('タイトルを更新する', async () => {
      mockFetch({ ...RAW_SUBTASK, title: '更新後の作業' })

      const result = await repo.update('subtask-1', { title: '更新後の作業' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.title).toBe('更新後の作業')
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks/subtask-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '更新後の作業' }),
        credentials: 'same-origin',
      })
    })
  })

  describe('delete', () => {
    it('作業項目を削除できる', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)

      const result = await repo.delete('subtask-1')

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks/subtask-1', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    })
  })

  describe('updateOrder', () => {
    it('作業項目の順序をまとめて更新する', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)

      const items = [
        { id: 'subtask-2', order: 0 },
        { id: 'subtask-1', order: 1 },
      ]
      const result = await repo.updateOrder(items)

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/subtasks/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        credentials: 'same-origin',
      })
    })
  })
})

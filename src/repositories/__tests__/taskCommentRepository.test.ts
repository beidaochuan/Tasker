import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ApiTaskCommentRepository } from '../apiTaskCommentRepository'

const repo = new ApiTaskCommentRepository()

const RAW_COMMENT = {
  id: 'comment-1',
  taskId: 1,
  body: 'コメント1',
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

describe('ApiTaskCommentRepository', () => {
  describe('getByTaskId', () => {
    it('taskId を URL エンコードし、API の並び順を保って型変換する', async () => {
      mockFetch([
        RAW_COMMENT,
        { ...RAW_COMMENT, id: 'comment-2', body: 'コメント2', createdAt: 2_000_000 },
      ])

      const result = await repo.getByTaskId(42)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.map((comment) => comment.id)).toEqual(['comment-1', 'comment-2'])
      expect(result.data[0].createdAt).toBeInstanceOf(Date)
      expect(result.data[0].createdAt.getTime()).toBe(1_000_000)
      expect(global.fetch).toHaveBeenCalledWith('/api/comments?taskId=42', {
        credentials: 'same-origin',
      })
    })
  })

  describe('create', () => {
    it('コメントを作成して返す', async () => {
      mockFetch(RAW_COMMENT, 201)

      const result = await repo.create({ taskId: 1, body: 'コメント1' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual(
        expect.objectContaining({ id: 'comment-1', taskId: 1, body: 'コメント1' })
      )
      expect(global.fetch).toHaveBeenCalledWith('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 1, body: 'コメント1' }),
        credentials: 'same-origin',
      })
    })
  })

  describe('update', () => {
    it('本文を更新する', async () => {
      mockFetch({ ...RAW_COMMENT, body: '更新後のコメント' })

      const result = await repo.update('comment-1', { body: '更新後のコメント' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.body).toBe('更新後のコメント')
      expect(global.fetch).toHaveBeenCalledWith('/api/comments/comment-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: '更新後のコメント' }),
        credentials: 'same-origin',
      })
    })
  })

  describe('delete', () => {
    it('コメントを削除できる', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)

      const result = await repo.delete('comment-1')

      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/comments/comment-1', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    })
  })
})

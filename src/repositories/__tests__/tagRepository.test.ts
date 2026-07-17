import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ApiTagRepository } from '../apiTagRepository'

const repo = new ApiTagRepository()

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

describe('ApiTagRepository', () => {
  describe('getAll', () => {
    it('タグ一覧を返す', async () => {
      mockFetch([{ id: 'tag-1', name: 'Tag', color: '#000' }])
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('tag-1')
    })

    it('空なら空配列を返す', async () => {
      mockFetch([])
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual([])
    })
  })

  describe('create', () => {
    it('タグを作成して返す', async () => {
      mockFetch({ id: 'tag-new', name: 'NewTag', color: '#f00' }, 201)
      const result = await repo.create({ name: 'NewTag', color: '#f00' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBe('tag-new')
      expect(result.data.name).toBe('NewTag')
    })

    it('重複エラーは CONFLICT として返す', async () => {
      mockFetch({ error: 'DUPLICATE' }, 409)
      const result = await repo.create({ name: 'Tag', color: '#f00' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('CONFLICT')
      expect(result.error.message).toBe('DUPLICATE')
    })
  })

  describe('delete', () => {
    it('タグを削除できる', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)
      const result = await repo.delete('tag-1')
      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/tag-1', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
    })
  })
})

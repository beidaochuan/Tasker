import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiProjectRepository } from '../apiProjectRepository'

const repo = new ApiProjectRepository()

const RAW_PROJECT = {
  id: 'proj-1',
  name: 'テストプロジェクト',
  description: '',
  color: '#3b82f6',
  status: 'active',
  isArchived: 0,
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

describe('ApiProjectRepository', () => {
  describe('create', () => {
    it('プロジェクトを作成して返す', async () => {
      mockFetch(RAW_PROJECT, 201)
      const result = await repo.create({
        name: 'テストプロジェクト',
        description: '',
        color: '#3b82f6',
        status: 'active',
        isArchived: false,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.id).toBe('proj-1')
      expect(result.data.name).toBe('テストプロジェクト')
      expect(result.data.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('getAll', () => {
    it('プロジェクト一覧を返す', async () => {
      mockFetch([RAW_PROJECT, { ...RAW_PROJECT, id: 'proj-2', name: 'B' }])
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toHaveLength(2)
      expect(result.data[0].createdAt).toBeInstanceOf(Date)
    })

    it('空なら空配列を返す', async () => {
      mockFetch([])
      const result = await repo.getAll()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data).toEqual([])
    })
  })

  describe('getById', () => {
    it('存在するIDで取得できる', async () => {
      mockFetch(RAW_PROJECT)
      const result = await repo.getById('proj-1')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.name).toBe('テストプロジェクト')
    })

    it('存在しないIDは NOT_FOUND エラー', async () => {
      mockFetch({ error: 'NOT_FOUND' }, 404)
      const result = await repo.getById('nonexistent')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('update', () => {
    it('フィールドを更新できる', async () => {
      mockFetch({ ...RAW_PROJECT, name: '新名' })
      const result = await repo.update('proj-1', { name: '新名' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.name).toBe('新名')
    })

    it('存在しないIDは NOT_FOUND エラー', async () => {
      mockFetch({ error: 'NOT_FOUND' }, 404)
      const result = await repo.update('nonexistent', { name: 'X' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('delete', () => {
    it('プロジェクトを削除できる (サーバー側でカスケード削除)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as unknown as Response)
      const result = await repo.delete('proj-1')
      expect(result.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('/api/projects/proj-1', { method: 'DELETE' })
    })
  })
})

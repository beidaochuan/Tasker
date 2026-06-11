import { describe, it, expect } from 'vitest'
import { applyFilter } from '@/utils/filterUtils'
import type { Task } from '@/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    topicId: 'topic-1',
    title: 'テストタスク',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    startDate: null,
    order: 0,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const BASE_FILTER = {
  searchText: '',
  statuses: [] as Task['status'][],
  priorities: [] as Task['priority'][],
  tagIds: [] as string[],
  dueDateFrom: null as Date | null,
  dueDateTo: null as Date | null,
}

describe('applyFilter', () => {
  it('フィルタなしは全件通過', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })]
    expect(applyFilter(tasks, BASE_FILTER)).toHaveLength(2)
  })

  describe('searchText', () => {
    it('タイトル部分一致でヒット', () => {
      const tasks = [makeTask({ title: 'バグ修正' }), makeTask({ title: '機能追加' })]
      expect(applyFilter(tasks, { ...BASE_FILTER, searchText: 'バグ' })).toHaveLength(1)
    })

    it('説明文も検索対象', () => {
      const tasks = [makeTask({ description: '詳細メモ' }), makeTask({ description: '別メモ' })]
      expect(applyFilter(tasks, { ...BASE_FILTER, searchText: '詳細' })).toHaveLength(1)
    })

    it('大文字小文字を区別しない（英字）', () => {
      const tasks = [makeTask({ title: 'Hello World' })]
      expect(applyFilter(tasks, { ...BASE_FILTER, searchText: 'hello' })).toHaveLength(1)
    })
  })

  describe('statuses', () => {
    it('指定ステータスのみ通過', () => {
      const tasks = [
        makeTask({ id: 'a', status: 'todo' }),
        makeTask({ id: 'b', status: 'done' }),
        makeTask({ id: 'c', status: 'in_progress' }),
      ]
      const result = applyFilter(tasks, { ...BASE_FILTER, statuses: ['todo', 'in_progress'] })
      expect(result.map((t) => t.id)).toEqual(['a', 'c'])
    })

    it('空配列は全件通過', () => {
      const tasks = [makeTask({ status: 'done' }), makeTask({ status: 'todo' })]
      expect(applyFilter(tasks, { ...BASE_FILTER, statuses: [] })).toHaveLength(2)
    })
  })

  describe('priorities', () => {
    it('指定優先度のみ通過', () => {
      const tasks = [
        makeTask({ id: 'a', priority: 'high' }),
        makeTask({ id: 'b', priority: 'low' }),
      ]
      const result = applyFilter(tasks, { ...BASE_FILTER, priorities: ['high'] })
      expect(result.map((t) => t.id)).toEqual(['a'])
    })

    it('空配列は全件通過', () => {
      const tasks = [makeTask({ priority: 'high' }), makeTask({ priority: 'low' })]
      expect(applyFilter(tasks, { ...BASE_FILTER, priorities: [] })).toHaveLength(2)
    })
  })

  describe('tagIds', () => {
    it('空配列は全件通過', () => {
      const tasks = [makeTask({ tags: ['tag-1'] }), makeTask({ tags: [] })]
      expect(applyFilter(tasks, { ...BASE_FILTER, tagIds: [] })).toHaveLength(2)
    })

    it('指定タグを持つタスクのみ通過', () => {
      const tasks = [
        makeTask({ id: 'a', tags: ['tag-1', 'tag-2'] }),
        makeTask({ id: 'b', tags: ['tag-2'] }),
        makeTask({ id: 'c', tags: ['tag-3'] }),
      ]
      const result = applyFilter(tasks, { ...BASE_FILTER, tagIds: ['tag-1'] })
      expect(result.map((t) => t.id)).toEqual(['a'])
    })

    it('複数タグを指定するとOR検索', () => {
      const tasks = [
        makeTask({ id: 'a', tags: ['tag-1'] }),
        makeTask({ id: 'b', tags: ['tag-2'] }),
        makeTask({ id: 'c', tags: ['tag-3'] }),
      ]
      const result = applyFilter(tasks, { ...BASE_FILTER, tagIds: ['tag-1', 'tag-2'] })
      expect(result.map((t) => t.id)).toEqual(['a', 'b'])
    })
  })

  describe('dueDateRange', () => {
    const d = (s: string) => new Date(s)

    it('dueDateFrom 以降のタスクのみ通過', () => {
      const tasks = [
        makeTask({ id: 'a', dueDate: d('2026-03-01') }),
        makeTask({ id: 'b', dueDate: d('2026-03-10') }),
        makeTask({ id: 'c', dueDate: null }),
      ]
      const result = applyFilter(tasks, {
        ...BASE_FILTER,
        dueDateFrom: d('2026-03-05'),
        dueDateTo: null,
      })
      expect(result.map((t) => t.id)).toEqual(['b'])
    })

    it('dueDateTo 以前のタスクのみ通過', () => {
      const tasks = [
        makeTask({ id: 'a', dueDate: d('2026-03-01') }),
        makeTask({ id: 'b', dueDate: d('2026-03-10') }),
      ]
      const result = applyFilter(tasks, {
        ...BASE_FILTER,
        dueDateFrom: null,
        dueDateTo: d('2026-03-05'),
      })
      expect(result.map((t) => t.id)).toEqual(['a'])
    })

    it('dueDate が null のタスクは日付フィルタで除外', () => {
      const tasks = [makeTask({ dueDate: null })]
      const result = applyFilter(tasks, {
        ...BASE_FILTER,
        dueDateFrom: d('2026-01-01'),
        dueDateTo: null,
      })
      expect(result).toHaveLength(0)
    })

    it('境界日は含む（from と to 当日は通過）', () => {
      const tasks = [makeTask({ id: 'a', dueDate: d('2026-03-05') })]
      const result = applyFilter(tasks, {
        ...BASE_FILTER,
        dueDateFrom: d('2026-03-05'),
        dueDateTo: d('2026-03-05'),
      })
      expect(result).toHaveLength(1)
    })
  })

  describe('複合フィルタ', () => {
    it('全条件 AND で絞り込む', () => {
      const tasks = [
        makeTask({
          id: 'a',
          title: 'バグ修正',
          status: 'todo',
          priority: 'high',
          tags: ['tag-1'],
          dueDate: new Date('2026-03-05'),
        }),
        makeTask({
          id: 'b',
          title: 'バグ修正',
          status: 'done',
          priority: 'high',
          tags: ['tag-1'],
          dueDate: new Date('2026-03-05'),
        }),
        makeTask({
          id: 'c',
          title: '別タスク',
          status: 'todo',
          priority: 'high',
          tags: ['tag-1'],
          dueDate: new Date('2026-03-05'),
        }),
      ]
      const result = applyFilter(tasks, {
        searchText: 'バグ',
        statuses: ['todo'],
        priorities: ['high'],
        tagIds: ['tag-1'],
        dueDateFrom: new Date('2026-03-01'),
        dueDateTo: new Date('2026-03-31'),
      })
      expect(result.map((t) => t.id)).toEqual(['a'])
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  sortByOrder,
  sortByDueDate,
  sortByPriority,
  sortKanbanColumnTasks,
  sortGanttTasks,
  reorderItems,
} from '../sortUtils'

type Ordered = { id: string; order: number }

describe('sortByOrder', () => {
  it('order 昇順に並べる', () => {
    const items: Ordered[] = [
      { id: 'c', order: 3 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]
    expect(sortByOrder(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('元配列を変更しない', () => {
    const items: Ordered[] = [
      { id: 'b', order: 2 },
      { id: 'a', order: 1 },
    ]
    const original = [...items]
    sortByOrder(items)
    expect(items).toEqual(original)
  })
})

describe('sortByDueDate', () => {
  const a = { id: 'a', dueDate: new Date(2024, 0, 1) }
  const b = { id: 'b', dueDate: new Date(2024, 0, 10) }
  const c = { id: 'c', dueDate: null }

  it('早い期日が先になる', () => {
    expect(sortByDueDate([b, a]).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('dueDate が null は末尾', () => {
    expect(sortByDueDate([c, a, b]).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortByPriority', () => {
  it('urgent > high > medium > low の順', () => {
    const items = [
      { id: 'l', priority: 'low' as const },
      { id: 'u', priority: 'urgent' as const },
      { id: 'm', priority: 'medium' as const },
      { id: 'h', priority: 'high' as const },
    ]
    expect(sortByPriority(items).map((i) => i.id)).toEqual(['u', 'h', 'm', 'l'])
  })
})

describe('sortKanbanColumnTasks', () => {
  const base = {
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }

  it.each(['todo', 'in_progress'] as const)('%s は優先度の高い順に並べる', (status) => {
    const items = [
      { ...base, id: 'low', priority: 'low' as const },
      { ...base, id: 'urgent', priority: 'urgent' as const },
      { ...base, id: 'high', priority: 'high' as const },
    ]

    expect(sortKanbanColumnTasks(status, items).map((item) => item.id)).toEqual([
      'urgent',
      'high',
      'low',
    ])
  })

  it.each(['done', 'cancelled'] as const)('%s は状態変更日時の新しい順に並べる', (status) => {
    const items = [
      {
        ...base,
        id: 'older',
        priority: 'urgent' as const,
        statusChangedAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        ...base,
        id: 'newer',
        priority: 'low' as const,
        statusChangedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ]

    expect(sortKanbanColumnTasks(status, items).map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('旧データは updatedAt を状態変更日時として扱う', () => {
    const items = [
      { id: 'older', priority: 'high' as const, updatedAt: new Date('2026-01-02T00:00:00Z') },
      { id: 'newer', priority: 'low' as const, updatedAt: new Date('2026-01-03T00:00:00Z') },
    ]

    expect(sortKanbanColumnTasks('done', items).map((item) => item.id)).toEqual(['newer', 'older'])
  })
})

describe('sortGanttTasks', () => {
  const early = { title: '早い', dueDate: new Date(2024, 0, 1), ganttOrder: null }
  const late = { title: '遅い', dueDate: new Date(2024, 0, 10), ganttOrder: null }
  const undated = { title: '期日なし', dueDate: null, ganttOrder: null }

  it('手動順序がなければ期日の早い順で、期日なしは末尾にする', () => {
    expect(sortGanttTasks([undated, late, early]).map((task) => task.title)).toEqual([
      '早い',
      '遅い',
      '期日なし',
    ])
  })

  it('手動順序があればガント専用順序を優先する', () => {
    expect(
      sortGanttTasks([{ ...early, ganttOrder: 1 }, { ...late, ganttOrder: 0 }, undated]).map(
        (task) => task.title
      )
    ).toEqual(['遅い', '早い', '期日なし'])
  })
})

describe('reorderItems', () => {
  it('移動後に order が 0 始まりの連番になる', () => {
    const items: Ordered[] = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ]
    const result = reorderItems(items, 0, 2)
    expect(result.find((i) => i.id === 'a')?.order).toBe(2)
    expect(result.find((i) => i.id === 'b')?.order).toBe(0)
    expect(result.find((i) => i.id === 'c')?.order).toBe(1)
  })

  it('同じ位置への移動は変化なし', () => {
    const items: Ordered[] = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
    ]
    const result = reorderItems(items, 0, 0)
    expect(result.map((i) => i.id)).toEqual(['a', 'b'])
  })
})

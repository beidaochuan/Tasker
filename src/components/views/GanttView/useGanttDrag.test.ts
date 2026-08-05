import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { calcGanttRange } from './useGanttDrag'

function taskWithDates(startDate: Date | null, dueDate: Date | null): Task {
  return {
    id: 'task-1',
    topicId: 'topic-1',
    title: 'タスク',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: null,
    dueDate,
    startDate,
    order: 0,
    ganttOrder: null,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  }
}

describe('calcGanttRange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('過去のタスクがあっても表示起点を今日にする', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-30T15:45:00'))

    const range = calcGanttRange([
      {
        tasks: [taskWithDates(new Date('2026-06-01'), new Date('2026-06-10'))],
      },
    ])

    expect(range).toEqual({
      startDate: new Date('2026-07-30T00:00:00'),
      totalDays: 15,
    })
  })

  it('将来の期限と後方余白を含む表示日数を返す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-30T15:45:00'))

    const range = calcGanttRange([
      {
        tasks: [taskWithDates(new Date('2026-08-05'), new Date('2026-08-10'))],
      },
    ])

    expect(range).toEqual({
      startDate: new Date('2026-07-30T00:00:00'),
      totalDays: 26,
    })
  })
})

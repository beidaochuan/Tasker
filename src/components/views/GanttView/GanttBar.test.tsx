import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { GanttBar } from './GanttBar'

function makeTask(status: Task['status'] = 'todo', dueDate = new Date('2026-07-12')): Task {
  return {
    id: 'task-1',
    topicId: 'topic-1',
    title: '期限確認タスク',
    description: '',
    status,
    priority: 'medium',
    startDate: new Date('2026-07-10'),
    dueDate,
    order: 0,
    ganttOrder: 0,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  }
}

describe('GanttBar 期限超過ツールチップ', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00'))
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('バーに触れてから150msで期限超過を含む情報を表示する', async () => {
    const { container } = render(
      <GanttBar task={makeTask()} ganttStart={new Date('2026-07-01')} scale="day" />
    )
    const bar = container.firstElementChild as HTMLElement

    fireEvent.pointerMove(bar, { pointerType: 'mouse' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(149)
    })
    expect(screen.queryByRole('tooltip')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(screen.getByRole('tooltip')).toHaveTextContent('期限確認タスク')
    expect(screen.getByRole('tooltip')).toHaveTextContent('3日超過')
  })

  it.each([
    ['todo', 'bg-slate-400'],
    ['in_progress', 'bg-blue-500'],
    ['done', 'bg-emerald-500'],
  ] as const)('%s の状態色をバーに使用する', (status, colorClass) => {
    const { container } = render(
      <GanttBar task={makeTask(status)} ganttStart={new Date('2026-07-01')} scale="day" />
    )

    expect(container.firstElementChild).toHaveClass(colorClass)
  })

  it.each([
    ['完了済み', makeTask('done')],
    ['期限内', makeTask('todo', new Date('2026-07-16'))],
  ])('%sのバーには超過日数を付記しない', (_label, task) => {
    const { container } = render(
      <GanttBar task={task} ganttStart={new Date('2026-07-01')} scale="day" />
    )

    expect(container.firstElementChild).toHaveAttribute(
      'aria-label',
      expect.not.stringContaining('日超過')
    )
  })
})

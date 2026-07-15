import { cleanup, render } from '@testing-library/react'
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
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('未完了かつ期限超過のバーに超過日数を付記する', () => {
    const { container } = render(
      <GanttBar task={makeTask()} ganttStart={new Date('2026-07-01')} scale="day" />
    )

    expect(container.firstElementChild).toHaveAttribute('title', expect.stringContaining('3日超過'))
  })

  it.each([
    ['完了済み', makeTask('done')],
    ['期限内', makeTask('todo', new Date('2026-07-16'))],
  ])('%sのバーには超過日数を付記しない', (_label, task) => {
    const { container } = render(
      <GanttBar task={task} ganttStart={new Date('2026-07-01')} scale="day" />
    )

    expect(container.firstElementChild?.getAttribute('title')).not.toContain('日超過')
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { TaskRow } from './TaskRow'

const task: Task = {
  id: 'task-1',
  topicId: 'topic-1',
  title: '本日が期限のタスク',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: new Date(2026, 6, 15),
  startDate: null,
  order: 0,
  tags: [],
  repeatRule: null,
  createdAt: new Date(2026, 6, 14),
  updatedAt: new Date(2026, 6, 14),
}

describe('TaskRow', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('本日が期限の日付は警告色にしない', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15, 12))

    render(<TaskRow task={task} />)

    expect(screen.getByText('2026/07/15')).toHaveClass('text-muted-foreground')
    expect(screen.getByText('2026/07/15')).not.toHaveClass('text-danger')
  })
})

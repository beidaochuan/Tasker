import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { CATEGORY_LABELS } from '@/utils/taskPresentation'
import { TaskRow } from './TaskRow'

const task: Task = {
  id: 'task-1',
  topicId: 'topic-1',
  title: '本日が期限のタスク',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: null,
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

  it('区分が設定されていない場合はバッジを表示しない', () => {
    render(<TaskRow task={task} />)

    expect(screen.queryByText(CATEGORY_LABELS.software)).not.toBeInTheDocument()
    expect(screen.queryByText(CATEGORY_LABELS.electric)).not.toBeInTheDocument()
  })

  it('区分が設定されている場合はバッジで表示する', () => {
    render(<TaskRow task={{ ...task, category: 'software' }} />)

    expect(screen.getByText(CATEGORY_LABELS.software)).toBeInTheDocument()
  })
})

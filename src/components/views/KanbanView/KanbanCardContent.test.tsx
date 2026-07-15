import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { PRIORITY_LABELS } from '@/utils/taskPresentation'
import { KanbanCardContent } from './KanbanCardContent'

const task: Task = {
  id: 'task-1',
  topicId: 'topic-1',
  title: '視認性を確認するタスク',
  description: 'card description',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  startDate: null,
  order: 0,
  tags: [],
  repeatRule: null,
  createdAt: new Date('2026-07-14T00:00:00Z'),
  updatedAt: new Date('2026-07-14T00:00:00Z'),
}

describe('KanbanCardContent', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('タイトルを15px・semibold・2行省略で表示する', () => {
    render(<KanbanCardContent task={task} />)

    expect(screen.getByText(task.title)).toHaveClass(
      'font-soft',
      'text-[15px]',
      'font-semibold',
      'line-clamp-2'
    )
    expect(screen.queryByText(task.description)).not.toBeInTheDocument()
    expect(screen.queryByTitle(PRIORITY_LABELS[task.priority])).not.toBeInTheDocument()
  })

  it('優先度を色付きの薄い背景を持つバッジで表示する', () => {
    render(<KanbanCardContent task={task} />)

    expect(screen.getByText(PRIORITY_LABELS[task.priority])).toHaveClass(
      'bg-amber-500/15',
      'text-[hsl(var(--priority-medium))]'
    )
  })

  it('期限超過の日付には文字表示用の警告色を使用する', () => {
    render(<KanbanCardContent task={{ ...task, dueDate: new Date(2000, 0, 1) }} />)

    expect(screen.getByText('2000/01/01')).toHaveClass('text-danger')
  })

  it('本日が期限の日付は警告色にしない', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15, 12))

    render(<KanbanCardContent task={{ ...task, dueDate: new Date(2026, 6, 15) }} />)

    expect(screen.getByText('2026/07/15')).toHaveClass('text-muted-foreground')
    expect(screen.getByText('2026/07/15')).not.toHaveClass('text-danger')
  })
})

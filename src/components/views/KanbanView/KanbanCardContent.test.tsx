import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
})

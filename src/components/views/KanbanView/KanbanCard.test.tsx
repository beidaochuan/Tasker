import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types'
import { KanbanCard } from './KanbanCard'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

const TASK: Task = {
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
}

describe('KanbanCard focus', () => {
  afterEach(() => {
    cleanup()
  })

  it('マウスフォーカスの既定枠を抑え、キーボードフォーカスだけを表示する', () => {
    render(<KanbanCard task={TASK} canEdit />)

    const card = screen.getByRole('button')
    expect(card).toHaveClass('focus:outline-none')
    expect(card).toHaveClass('focus-visible:ring-2')
    expect(card).toHaveClass('focus-visible:ring-ring')
  })
})

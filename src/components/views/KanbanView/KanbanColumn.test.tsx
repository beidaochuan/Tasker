import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KanbanColumn } from './KanbanColumn'

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn() }),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('./KanbanCard', () => ({ KanbanCard: () => null }))

describe('KanbanColumn 状態色', () => {
  afterEach(() => {
    cleanup()
  })

  it.each([
    ['todo', '未着手', 'text-slate-600', 'dark:text-slate-300', 'bg-slate-400'],
    ['in_progress', '進行中', 'text-blue-600', 'dark:text-blue-400', 'bg-blue-500'],
    ['done', '完了', 'text-emerald-600', 'dark:text-emerald-400', 'bg-emerald-500'],
  ] as const)(
    '%s の見出しとアクセントに共通の色相を使用する',
    (status, label, lightTextClass, darkTextClass, backgroundClass) => {
      const { container } = render(
        <KanbanColumn
          status={status}
          tasks={[]}
          isOver={false}
          defaultTopicId={null}
          canEdit={false}
        />
      )

      expect(screen.getByText(label)).toHaveClass(lightTextClass, darkTextClass)
      expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(backgroundClass)
    }
  )
})

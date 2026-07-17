import type { ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, TaskStatus } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { KanbanView } from './KanbanView'

interface ActiveLike {
  id: string
  data: { current?: { task?: Task } }
}

interface DragEventLike {
  active: ActiveLike
  over: { id: string } | null
}

const { dndMock, kanbanDataMock, taskRepoMock } = vi.hoisted(() => ({
  dndMock: {
    onDragStart: null as ((event: { active: ActiveLike }) => unknown) | null,
    onDragOver: null as ((event: DragEventLike) => unknown) | null,
    onDragEnd: null as ((event: DragEventLike) => unknown) | null,
    onDragCancel: null as ((event: DragEventLike) => unknown) | null,
  },
  kanbanDataMock: {
    tasksByStatus: {} as Record<TaskStatus, Task[]>,
  },
  taskRepoMock: {
    update: vi.fn(),
  },
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  }: {
    children: ReactNode
    onDragStart: NonNullable<typeof dndMock.onDragStart>
    onDragOver: NonNullable<typeof dndMock.onDragOver>
    onDragEnd: NonNullable<typeof dndMock.onDragEnd>
    onDragCancel: NonNullable<typeof dndMock.onDragCancel>
  }) => {
    dndMock.onDragStart = onDragStart
    dndMock.onDragOver = onDragOver
    dndMock.onDragEnd = onDragEnd
    dndMock.onDragCancel = onDragCancel
    return children
  },
  DragOverlay: ({ children }: { children: ReactNode }) => children,
  PointerSensor: class PointerSensor {},
  closestCorners: vi.fn(),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@/hooks/useTasks', () => ({
  useKanbanData: () => ({
    tasksByStatus: kanbanDataMock.tasksByStatus,
    defaultTopicId: 'topic-1',
    isLoading: false,
  }),
}))

vi.mock('@/repositories', () => ({
  taskRepo: taskRepoMock,
}))

vi.mock('./KanbanColumn', () => ({
  KanbanColumn: ({
    status,
    tasks,
    isOver,
  }: {
    status: TaskStatus
    tasks: Task[]
    isOver: boolean
  }) => (
    <div data-testid={`column-${status}`} data-is-over={String(isOver)}>
      {tasks.map((task) => task.id).join(',')}
    </div>
  ),
}))

vi.mock('./KanbanCardContent', () => ({
  KanbanCardContent: ({ task }: { task: Task }) => <div>{task.title}</div>,
}))

function makeTask(id: string, status: TaskStatus): Task {
  return {
    id,
    topicId: 'topic-1',
    title: 'テストタスク',
    description: '',
    status,
    priority: 'medium',
    dueDate: null,
    startDate: null,
    order: 0,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

const TASK = makeTask('task-1', 'todo')

function dragEvent(overId: string | null): DragEventLike {
  return {
    active: { id: TASK.id, data: { current: { task: TASK } } },
    over: overId ? { id: overId } : null,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('KanbanView drag focus', () => {
  beforeEach(() => {
    dndMock.onDragStart = null
    dndMock.onDragOver = null
    dndMock.onDragEnd = null
    dndMock.onDragCancel = null
    taskRepoMock.update.mockReset()
    kanbanDataMock.tasksByStatus = {
      todo: [TASK],
      in_progress: [],
      done: [],
    }
    useAuthStore.setState({ isAuthenticated: true, isLoginDialogOpen: false })
    useUIStore.setState({ selectedProjectId: 'project-1' })
  })

  afterEach(() => {
    cleanup()
  })

  it('ドラッグ対象が列の外へ出たら列の枠を解除する', () => {
    render(<KanbanView />)

    act(() => {
      dndMock.onDragStart?.({ active: dragEvent(null).active })
      dndMock.onDragOver?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveAttribute('data-is-over', 'true')

    act(() => {
      dndMock.onDragOver?.(dragEvent(null))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveAttribute('data-is-over', 'false')
  })

  it('ドラッグをキャンセルしたら列の枠と移動プレビューを解除する', () => {
    render(<KanbanView />)

    act(() => {
      dndMock.onDragStart?.({ active: dragEvent(null).active })
      dndMock.onDragOver?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveTextContent(TASK.id)

    act(() => {
      dndMock.onDragCancel?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveAttribute('data-is-over', 'false')
    expect(screen.getByTestId('column-in_progress')).toBeEmptyDOMElement()
    expect(screen.getByTestId('column-todo')).toHaveTextContent(TASK.id)
  })

  it('ドロップ後は保存完了を待たずに列の枠を解除する', async () => {
    const update = deferred<{ ok: true; data: Task }>()
    taskRepoMock.update.mockReturnValue(update.promise)
    const { rerender } = render(<KanbanView />)

    act(() => {
      dndMock.onDragStart?.({ active: dragEvent(null).active })
      dndMock.onDragOver?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveAttribute('data-is-over', 'true')

    let dropPromise: unknown
    act(() => {
      dropPromise = dndMock.onDragEnd?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveAttribute('data-is-over', 'false')

    update.resolve({ ok: true, data: { ...TASK, status: 'in_progress' } })
    await act(async () => {
      await dropPromise
    })

    expect(screen.getByTestId('column-in_progress')).toHaveTextContent(TASK.id)
    expect(screen.getByTestId('column-todo')).toBeEmptyDOMElement()

    kanbanDataMock.tasksByStatus = {
      todo: [],
      in_progress: [{ ...TASK, status: 'in_progress' }],
      done: [],
    }
    await act(async () => {
      rerender(<KanbanView />)
      await Promise.resolve()
    })

    kanbanDataMock.tasksByStatus = {
      todo: [],
      in_progress: [],
      done: [{ ...TASK, status: 'done' }],
    }
    rerender(<KanbanView />)
    expect(screen.getByTestId('column-done')).toHaveTextContent(TASK.id)
  })

  it('保存済みpreviewの再取得待ちでもプロジェクト切替時に旧タスクを残さない', async () => {
    taskRepoMock.update.mockResolvedValue({
      ok: true,
      data: { ...TASK, status: 'in_progress' },
    })
    const project2Task = makeTask('project-2-task', 'todo')
    render(<KanbanView />)

    act(() => {
      dndMock.onDragStart?.({ active: dragEvent(null).active })
      dndMock.onDragOver?.(dragEvent('in_progress'))
    })
    await act(async () => {
      await dndMock.onDragEnd?.(dragEvent('in_progress'))
    })
    expect(screen.getByTestId('column-in_progress')).toHaveTextContent(TASK.id)

    kanbanDataMock.tasksByStatus = {
      todo: [project2Task],
      in_progress: [],
      done: [],
    }
    await act(async () => {
      useUIStore.getState().setSelectedProjectId('project-2')
      await Promise.resolve()
    })

    expect(screen.getByTestId('column-todo')).toHaveTextContent(project2Task.id)
    expect(screen.getByTestId('column-in_progress')).toBeEmptyDOMElement()
    expect(screen.queryByText(TASK.id)).toBeNull()
  })
})

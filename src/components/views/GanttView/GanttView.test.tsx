import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, Topic } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { GanttView } from './GanttView'

interface DragEventLike {
  active: { id: string }
  over: { id: string } | null
}

const { dndMock, ganttDataMock, taskRepoMock, calcGanttRangeMock, emptyPreview } = vi.hoisted(
  () => ({
    dndMock: {
      onDragStart: null as ((event: Pick<DragEventLike, 'active'>) => unknown) | null,
      onDragOver: null as ((event: DragEventLike) => unknown) | null,
      onDragEnd: null as ((event: DragEventLike) => unknown) | null,
      onDragCancel: null as (() => unknown) | null,
    },
    ganttDataMock: {
      rows: [] as Array<{ topic: Topic; tasks: Task[] }>,
    },
    taskRepoMock: {
      update: vi.fn(),
      updateGanttOrder: vi.fn(),
    },
    calcGanttRangeMock: vi.fn(),
    emptyPreview: new Map(),
  })
)

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
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number
    estimateSize: (index: number) => number
  }) => {
    let start = 0
    const items = Array.from({ length: count }, (_, index) => {
      const size = estimateSize(index)
      const item = { index, start, size }
      start += size
      return item
    })
    return {
      getTotalSize: () => start,
      getVirtualItems: () => items,
    }
  },
}))

vi.mock('@/repositories', () => ({
  taskRepo: taskRepoMock,
}))

vi.mock('@/hooks/useGanttData', () => ({
  useGanttData: () => ganttDataMock.rows,
}))

vi.mock('./useGanttDrag', () => ({
  calcGanttRange: calcGanttRangeMock,
  useGanttDrag: () => ({
    preview: emptyPreview,
    clearPreview: vi.fn(),
    onBarPointerDown: vi.fn(),
  }),
}))

vi.mock('./GanttHeader', () => ({ GanttHeader: () => null }))
vi.mock('./GanttRow', () => ({ GanttRow: () => <div data-testid="gantt-row" /> }))
vi.mock('./GanttTodayLine', () => ({ GanttTodayLine: () => null }))

function makeTask(
  id: string,
  title: string,
  ganttOrder: number,
  status: Task['status'] = 'todo'
): Task {
  return {
    id,
    topicId: 'topic-1',
    title,
    description: '',
    status,
    priority: 'medium',
    dueDate: new Date('2026-01-10'),
    startDate: new Date('2026-01-08'),
    order: ganttOrder,
    ganttOrder,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const TOPIC: Topic = {
  id: 'topic-1',
  projectId: 'project-1',
  name: '開発',
  order: 0,
  createdAt: new Date('2026-01-01'),
}

const TASKS = [
  makeTask('task-a', 'タスクA', 0),
  makeTask('task-b', 'タスクB', 1),
  makeTask('task-c', 'タスクC', 2),
]

function displayedTaskLabels() {
  return screen
    .getAllByRole('button', { name: /ドラッグして並べ替え$/ })
    .map((button) => button.getAttribute('aria-label'))
}

describe('GanttView task reordering', () => {
  beforeEach(() => {
    dndMock.onDragStart = null
    dndMock.onDragOver = null
    dndMock.onDragEnd = null
    dndMock.onDragCancel = null
    taskRepoMock.update.mockReset()
    taskRepoMock.updateGanttOrder.mockReset()
    calcGanttRangeMock.mockReset()
    calcGanttRangeMock.mockReturnValue({
      startDate: new Date('2026-01-01'),
      totalDays: 60,
    })
    ganttDataMock.rows = [{ topic: TOPIC, tasks: TASKS }]
    useAuthStore.setState({ isAuthenticated: true, isLoginDialogOpen: false })
    useUIStore.setState({ selectedProjectId: 'project-1' })
  })

  afterEach(() => {
    cleanup()
  })

  it('ドラッグ中に表示順を更新し、ドロップ時にプレビュー順を保存する', async () => {
    const update = deferred<{ ok: true; data: undefined }>()
    taskRepoMock.updateGanttOrder.mockReturnValue(update.promise)
    render(<GanttView />)

    expect(displayedTaskLabels()).toEqual([
      'タスクAをドラッグして並べ替え',
      'タスクBをドラッグして並べ替え',
      'タスクCをドラッグして並べ替え',
    ])

    act(() => {
      dndMock.onDragStart?.({ active: { id: 'task-a' } })
      dndMock.onDragOver?.({ active: { id: 'task-a' }, over: { id: 'task-c' } })
    })

    expect(displayedTaskLabels()).toEqual([
      'タスクBをドラッグして並べ替え',
      'タスクCをドラッグして並べ替え',
      'タスクAをドラッグして並べ替え',
    ])
    expect(
      screen
        .getAllByRole('button', { name: /ドラッグして並べ替え$/ })
        .every((button) => button.parentElement?.style.transition === 'top 250ms ease')
    ).toBe(true)
    expect(
      screen
        .getAllByTestId('gantt-row')
        .every((row) => row.parentElement?.style.transition === 'top 250ms ease')
    ).toBe(true)
    expect(taskRepoMock.updateGanttOrder).not.toHaveBeenCalled()

    act(() => {
      dndMock.onDragOver?.({ active: { id: 'task-a' }, over: { id: 'task-c' } })
    })
    expect(displayedTaskLabels()).toEqual([
      'タスクBをドラッグして並べ替え',
      'タスクCをドラッグして並べ替え',
      'タスクAをドラッグして並べ替え',
    ])

    let savePromise: Promise<void> | undefined
    act(() => {
      const result = dndMock.onDragEnd?.({
        active: { id: 'task-a' },
        over: { id: 'task-a' },
      })
      savePromise = Promise.resolve(result).then(() => undefined)
    })

    expect(displayedTaskLabels()).toEqual([
      'タスクBをドラッグして並べ替え',
      'タスクCをドラッグして並べ替え',
      'タスクAをドラッグして並べ替え',
    ])
    expect(taskRepoMock.updateGanttOrder).toHaveBeenCalledWith([
      { id: 'task-b', ganttOrder: 0 },
      { id: 'task-c', ganttOrder: 1 },
      { id: 'task-a', ganttOrder: 2 },
    ])

    await act(async () => {
      update.resolve({ ok: true, data: undefined })
      await savePromise
    })
  })

  it('完了タスクを初期状態で隠し、トグルで元の位置に表示する', () => {
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [makeTask('task-done', '完了タスク', 0, 'done')],
      },
    ]

    render(<GanttView />)

    const toggle = screen.getByRole('checkbox', { name: '完了を表示（1）' })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText('開発')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完了タスクをドラッグして並べ替え' })).toBeNull()
    expect(screen.queryAllByTestId('gantt-row')).toHaveLength(0)
    expect(calcGanttRangeMock).not.toHaveBeenCalled()

    fireEvent.click(toggle)

    expect(toggle).toBeChecked()
    expect(
      screen.getByRole('button', { name: '完了タスクをドラッグして並べ替え' })
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('gantt-row')).toHaveLength(1)
    expect(calcGanttRangeMock).toHaveBeenLastCalledWith(ganttDataMock.rows)
  })

  it('完了タスクを隠した並び替えでも全タスクの順序を重複なく保存する', async () => {
    const update = deferred<{ ok: true; data: undefined }>()
    taskRepoMock.updateGanttOrder.mockReturnValue(update.promise)
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          makeTask('task-a', 'タスクA', 0),
          makeTask('task-done', '完了タスク', 1, 'done'),
          makeTask('task-b', 'タスクB', 2),
        ],
      },
    ]
    render(<GanttView />)

    expect(displayedTaskLabels()).toEqual([
      'タスクAをドラッグして並べ替え',
      'タスクBをドラッグして並べ替え',
    ])

    act(() => {
      dndMock.onDragStart?.({ active: { id: 'task-a' } })
      dndMock.onDragOver?.({ active: { id: 'task-a' }, over: { id: 'task-b' } })
    })

    expect(displayedTaskLabels()).toEqual([
      'タスクBをドラッグして並べ替え',
      'タスクAをドラッグして並べ替え',
    ])

    let savePromise: Promise<void> | undefined
    act(() => {
      const result = dndMock.onDragEnd?.({
        active: { id: 'task-a' },
        over: { id: 'task-a' },
      })
      savePromise = Promise.resolve(result).then(() => undefined)
    })

    expect(taskRepoMock.updateGanttOrder).toHaveBeenCalledWith([
      { id: 'task-b', ganttOrder: 0 },
      { id: 'task-done', ganttOrder: 1 },
      { id: 'task-a', ganttOrder: 2 },
    ])

    await act(async () => {
      update.resolve({ ok: true, data: undefined })
      await savePromise
    })
  })

  it('完了タスク表示中は完了タスクを含む全順序を並べ替えて保存する', async () => {
    const update = deferred<{ ok: true; data: undefined }>()
    taskRepoMock.updateGanttOrder.mockReturnValue(update.promise)
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          makeTask('task-a', 'タスクA', 0),
          makeTask('task-done', '完了タスク', 1, 'done'),
          makeTask('task-b', 'タスクB', 2),
        ],
      },
    ]
    render(<GanttView />)
    fireEvent.click(screen.getByRole('checkbox', { name: '完了を表示（1）' }))

    act(() => {
      dndMock.onDragStart?.({ active: { id: 'task-a' } })
      dndMock.onDragOver?.({ active: { id: 'task-a' }, over: { id: 'task-b' } })
    })

    let savePromise: Promise<void> | undefined
    act(() => {
      const result = dndMock.onDragEnd?.({
        active: { id: 'task-a' },
        over: { id: 'task-a' },
      })
      savePromise = Promise.resolve(result).then(() => undefined)
    })

    expect(taskRepoMock.updateGanttOrder).toHaveBeenCalledWith([
      { id: 'task-done', ganttOrder: 0 },
      { id: 'task-b', ganttOrder: 1 },
      { id: 'task-a', ganttOrder: 2 },
    ])

    await act(async () => {
      update.resolve({ ok: true, data: undefined })
      await savePromise
    })
  })
})

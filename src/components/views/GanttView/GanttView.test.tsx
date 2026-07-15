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
    useUIStore.setState({ selectedProjectId: 'project-1', expandedCompletedTopicIds: {} })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('優先度ラベルをタスク行の上下中央に配置する', () => {
    render(<GanttView />)

    expect(
      screen
        .getAllByText('中')
        .every((label) =>
          ['inline-flex', 'h-5', 'items-center', 'leading-none'].every((className) =>
            label.classList.contains(className)
          )
        )
    ).toBe(true)
  })

  it('期限超過の未完了タスクに超過日数バッジを表示する', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00'))
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          {
            ...makeTask('task-overdue', '期限超過タスク', 0),
            dueDate: new Date('2026-07-12'),
          },
        ],
      },
    ]

    render(<GanttView />)

    expect(screen.getByText('3日超過')).toHaveClass('bg-danger/10', 'text-danger')
    expect(screen.getByTitle('期限を3日超過')).toBeInTheDocument()
  })

  it('完了タスクには期限超過バッジを表示しない', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00'))
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          {
            ...makeTask('task-done', '完了タスク', 0, 'done'),
            dueDate: new Date('2026-07-12'),
          },
        ],
      },
    ]

    render(<GanttView />)
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（1）' }))

    expect(screen.queryByText('3日超過')).toBeNull()
  })

  it('トピック行からそのトピックの新規タスク作成を開始する', () => {
    render(<GanttView />)

    fireEvent.click(screen.getByRole('button', { name: '開発 にタスクを追加' }))

    expect(useUIStore.getState()).toMatchObject({
      isTaskDrawerOpen: true,
      selectedTaskId: null,
      newTaskTopicId: TOPIC.id,
    })
  })

  it('未ログイン時は新規タスク作成ボタンを表示しない', () => {
    useAuthStore.setState({ isAuthenticated: false })

    render(<GanttView />)

    expect(screen.queryByRole('button', { name: '開発 にタスクを追加' })).toBeNull()
  })

  it('タスクのタイトルをクリックすると編集画面を開く', () => {
    render(<GanttView />)

    fireEvent.click(screen.getByRole('button', { name: 'タスクAを編集' }))

    expect(useUIStore.getState()).toMatchObject({
      isTaskDrawerOpen: true,
      selectedTaskId: 'task-a',
      newTaskTopicId: null,
    })
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

  it('完了タスクを初期状態で隠し、グループを開くと表示する', () => {
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [makeTask('task-done', '完了タスク', 0, 'done')],
      },
    ]

    render(<GanttView />)

    const completedGroup = screen.getByRole('button', { name: '完了タスク（1）' })
    expect(completedGroup).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('開発')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完了タスクをドラッグして並べ替え' })).toBeNull()
    expect(screen.queryAllByTestId('gantt-row')).toHaveLength(0)
    expect(calcGanttRangeMock).not.toHaveBeenCalled()

    fireEvent.click(completedGroup)

    expect(completedGroup).toHaveAttribute('aria-expanded', 'true')
    expect(useUIStore.getState().expandedCompletedTopicIds[TOPIC.id]).toBe(true)
    expect(
      screen.getByRole('button', { name: '完了タスクをドラッグして並べ替え' })
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('gantt-row')).toHaveLength(1)
    expect(calcGanttRangeMock).toHaveBeenLastCalledWith(ganttDataMock.rows)
  })

  it('共有済みの開閉状態を初回描画に反映する', () => {
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [makeTask('task-done', '完了タスク', 0, 'done')],
      },
    ]
    useUIStore.getState().toggleCompletedTasks(TOPIC.id)

    render(<GanttView />)

    expect(screen.getByRole('button', { name: '完了タスク（1）' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(
      screen.getByRole('button', { name: '完了タスクをドラッグして並べ替え' })
    ).toBeInTheDocument()
  })

  it('完了タスクが0件なら完了グループを表示しない', () => {
    render(<GanttView />)

    expect(screen.queryByRole('button', { name: /完了タスク（/ })).toBeNull()
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
      { id: 'task-a', ganttOrder: 1 },
      { id: 'task-done', ganttOrder: 2 },
    ])

    await act(async () => {
      update.resolve({ ok: true, data: undefined })
      await savePromise
    })
  })

  it('完了グループを開いても同じグループ内の並び替えだけを保存する', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（1）' }))

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
      { id: 'task-b', ganttOrder: 0 },
      { id: 'task-a', ganttOrder: 1 },
      { id: 'task-done', ganttOrder: 2 },
    ])

    await act(async () => {
      update.resolve({ ok: true, data: undefined })
      await savePromise
    })
  })

  it('同一グループ内で移動した後も別グループ上でドロップしたら保存しない', () => {
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          makeTask('task-active-a', '未完了A', 0),
          makeTask('task-active-b', '未完了B', 1),
          makeTask('task-done', '完了', 2, 'done'),
        ],
      },
    ]
    render(<GanttView />)
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（1）' }))

    act(() => {
      dndMock.onDragStart?.({ active: { id: 'task-active-a' } })
      dndMock.onDragOver?.({ active: { id: 'task-active-a' }, over: { id: 'task-active-b' } })
    })

    expect(displayedTaskLabels()).toEqual([
      '未完了Bをドラッグして並べ替え',
      '未完了Aをドラッグして並べ替え',
      '完了をドラッグして並べ替え',
    ])

    act(() => {
      dndMock.onDragOver?.({ active: { id: 'task-active-a' }, over: { id: 'task-done' } })
      dndMock.onDragEnd?.({ active: { id: 'task-active-a' }, over: { id: 'task-done' } })
    })

    expect(displayedTaskLabels()).toEqual([
      '未完了Aをドラッグして並べ替え',
      '未完了Bをドラッグして並べ替え',
      '完了をドラッグして並べ替え',
    ])
    expect(taskRepoMock.updateGanttOrder).not.toHaveBeenCalled()
  })

  it('完了グループ内の並び替えを全タスク順序として保存する', async () => {
    taskRepoMock.updateGanttOrder.mockResolvedValue({ ok: true, data: undefined })
    ganttDataMock.rows = [
      {
        topic: TOPIC,
        tasks: [
          makeTask('task-active', '未完了', 0),
          makeTask('task-done-a', '完了A', 1, 'done'),
          makeTask('task-done-b', '完了B', 2, 'done'),
        ],
      },
    ]
    render(<GanttView />)
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（2）' }))

    await act(async () => {
      dndMock.onDragStart?.({ active: { id: 'task-done-a' } })
      dndMock.onDragOver?.({ active: { id: 'task-done-a' }, over: { id: 'task-done-b' } })
      await dndMock.onDragEnd?.({
        active: { id: 'task-done-a' },
        over: { id: 'task-done-a' },
      })
    })

    expect(taskRepoMock.updateGanttOrder).toHaveBeenCalledWith([
      { id: 'task-active', ganttOrder: 0 },
      { id: 'task-done-b', ganttOrder: 1 },
      { id: 'task-done-a', ganttOrder: 2 },
    ])
  })
})

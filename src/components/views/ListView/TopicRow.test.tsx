import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, Topic } from '@/types'
import { useFilterStore } from '@/store/filterStore'
import { useUIStore } from '@/store/uiStore'
import { useRefreshStore } from '@/hooks/useDataRefresh'
import { TopicRow } from './TopicRow'

const { taskRepoMock, topicRepoMock, dragMock } = vi.hoisted(() => ({
  taskRepoMock: {
    getByTopicId: vi.fn(),
    update: vi.fn(),
  },
  topicRepoMock: {
    update: vi.fn(),
    delete: vi.fn(),
  },
  dragMock: {
    onDragEnd: null as
      | ((event: { active: { id: string }; over: { id: string } | null }) => unknown)
      | null,
  },
}))

vi.mock('@/repositories', () => ({
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragEnd: NonNullable<typeof dragMock.onDragEnd>
  }) => {
    dragMock.onDragEnd = onDragEnd
    return children
  },
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  verticalListSortingStrategy: vi.fn(),
}))

vi.mock('@/components/task/SortableTaskRow', () => ({
  SortableTaskRow: ({ task, disabled }: { task: Task; disabled?: boolean }) => (
    <div data-testid="sortable-task" data-disabled={String(Boolean(disabled))}>
      {task.title}
    </div>
  ),
}))

function makeTask(id: string, title: string, order: number, status: Task['status'] = 'todo'): Task {
  return {
    id,
    topicId: 'topic-1',
    title,
    description: '',
    status,
    priority: 'medium',
    dueDate: null,
    startDate: null,
    order,
    tags: [],
    repeatRule: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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

function displayedTaskTitles() {
  return screen.getAllByTestId('sortable-task').map((row) => row.textContent)
}

describe('TopicRow', () => {
  beforeEach(() => {
    taskRepoMock.getByTopicId.mockReset()
    taskRepoMock.update.mockReset()
    topicRepoMock.update.mockReset()
    topicRepoMock.delete.mockReset()
    dragMock.onDragEnd = null
    useFilterStore.getState().resetFilters()
    useUIStore.setState({ expandedCompletedTopicIds: {} })
    useRefreshStore.setState({ counter: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('完了タスクを初期状態で隠し、グループを開くと相対順序を保って表示する', async () => {
    taskRepoMock.getByTopicId.mockResolvedValue({
      ok: true,
      data: [
        makeTask('task-done-a', '完了A', 0, 'done'),
        makeTask('task-active-a', '未完了A', 1),
        makeTask('task-done-b', '完了B', 2, 'done'),
        makeTask('task-active-b', '未完了B', 3, 'in_progress'),
      ],
    })

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)

    expect(await screen.findByText('未完了A')).toBeInTheDocument()
    const completedGroup = screen.getByRole('button', { name: '完了タスク（2）' })
    expect(completedGroup).toHaveAttribute('aria-expanded', 'false')
    expect(displayedTaskTitles()).toEqual(['未完了A', '未完了B'])
    expect(screen.queryByText('完了A')).toBeNull()

    fireEvent.click(completedGroup)

    expect(completedGroup).toHaveAttribute('aria-expanded', 'true')
    expect(useUIStore.getState().expandedCompletedTopicIds[TOPIC.id]).toBe(true)
    expect(displayedTaskTitles()).toEqual(['未完了A', '未完了B', '完了A', '完了B'])
    expect(taskRepoMock.update).not.toHaveBeenCalled()
  })

  it('完了タスクが0件なら完了グループを表示しない', async () => {
    taskRepoMock.getByTopicId.mockResolvedValue({ ok: true, data: TASKS })

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)

    expect(await screen.findByText('タスクA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完了タスク/ })).toBeNull()
  })

  it('フィルター適用後の完了タスク件数をグループに表示する', async () => {
    taskRepoMock.getByTopicId.mockResolvedValue({
      ok: true,
      data: [
        makeTask('task-active', '未完了', 0),
        makeTask('task-done-a', '完了A', 1, 'done'),
        makeTask('task-done-b', '完了B', 2, 'done'),
      ],
    })
    useFilterStore.getState().setStatuses(['done'])

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)

    const completedGroup = await screen.findByRole('button', { name: '完了タスク（2）' })
    expect(screen.queryByText('未完了')).toBeNull()
    fireEvent.click(completedGroup)
    expect(displayedTaskTitles()).toEqual(['完了A', '完了B'])
  })

  it('並び替え後の順序を保存・再取得が完了するまで保持する', async () => {
    const update = deferred<{ ok: true; data: Task }>()
    const refetch = deferred<{ ok: true; data: Task[] }>()
    taskRepoMock.getByTopicId
      .mockResolvedValueOnce({ ok: true, data: TASKS })
      .mockReturnValueOnce(refetch.promise)
    taskRepoMock.update.mockReturnValue(update.promise)

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)

    expect(await screen.findByText('タスクA')).toBeInTheDocument()
    expect(displayedTaskTitles()).toEqual(['タスクA', 'タスクB', 'タスクC'])

    let dragPromise: Promise<void> | undefined
    act(() => {
      const result = dragMock.onDragEnd?.({
        active: { id: 'task-a' },
        over: { id: 'task-c' },
      })
      dragPromise = Promise.resolve(result).then(() => undefined)
    })

    expect(displayedTaskTitles()).toEqual(['タスクB', 'タスクC', 'タスクA'])
    expect(
      screen.getAllByTestId('sortable-task').every((row) => row.dataset.disabled === 'true')
    ).toBe(true)
    expect(taskRepoMock.update.mock.calls.map(([id, updateData]) => [id, updateData])).toEqual([
      ['task-b', { order: 0 }],
      ['task-c', { order: 1 }],
      ['task-a', { order: 2 }],
    ])

    await act(async () => {
      update.resolve({ ok: true, data: TASKS[0] })
      await dragPromise
    })

    await waitFor(() => {
      expect(taskRepoMock.getByTopicId).toHaveBeenCalledTimes(2)
    })
    expect(displayedTaskTitles()).toEqual(['タスクB', 'タスクC', 'タスクA'])

    await act(async () => {
      refetch.resolve({
        ok: true,
        data: [
          { ...TASKS[1], order: 0 },
          { ...TASKS[2], order: 1 },
          { ...TASKS[0], order: 2 },
        ],
      })
    })

    await waitFor(() => {
      expect(
        screen.getAllByTestId('sortable-task').every((row) => row.dataset.disabled === 'false')
      ).toBe(true)
    })
    expect(displayedTaskTitles()).toEqual(['タスクB', 'タスクC', 'タスクA'])
  })

  it('完了グループを閉じた並び替えでも完了タスクを末尾に維持して保存する', async () => {
    const update = deferred<{ ok: true; data: Task }>()
    const tasks = [
      makeTask('task-active-a', '未完了A', 0),
      makeTask('task-active-b', '未完了B', 1),
      makeTask('task-done-a', '完了A', 2, 'done'),
      makeTask('task-done-b', '完了B', 3, 'done'),
    ]
    taskRepoMock.getByTopicId.mockResolvedValue({ ok: true, data: tasks })
    taskRepoMock.update.mockReturnValue(update.promise)

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)
    expect(await screen.findByText('未完了A')).toBeInTheDocument()

    let dragPromise: Promise<void> | undefined
    act(() => {
      const result = dragMock.onDragEnd?.({
        active: { id: 'task-active-a' },
        over: { id: 'task-active-b' },
      })
      dragPromise = Promise.resolve(result).then(() => undefined)
    })

    expect(displayedTaskTitles()).toEqual(['未完了B', '未完了A'])
    expect(taskRepoMock.update.mock.calls.map(([id, updateData]) => [id, updateData])).toEqual([
      ['task-active-b', { order: 0 }],
      ['task-active-a', { order: 1 }],
      ['task-done-a', { order: 2 }],
      ['task-done-b', { order: 3 }],
    ])

    await act(async () => {
      update.resolve({ ok: true, data: tasks[0] })
      await dragPromise
    })

    fireEvent.click(screen.getByRole('button', { name: '完了タスク（2）' }))
    expect(displayedTaskTitles()).toEqual(['未完了B', '未完了A', '完了A', '完了B'])
  })

  it('未完了と完了のグループをまたぐドラッグを保存しない', async () => {
    taskRepoMock.getByTopicId.mockResolvedValue({
      ok: true,
      data: [makeTask('task-active', '未完了', 0), makeTask('task-done', '完了', 1, 'done')],
    })

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)
    expect(await screen.findByText('未完了')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（1）' }))

    await act(async () => {
      await dragMock.onDragEnd?.({
        active: { id: 'task-active' },
        over: { id: 'task-done' },
      })
    })

    expect(displayedTaskTitles()).toEqual(['未完了', '完了'])
    expect(taskRepoMock.update).not.toHaveBeenCalled()
  })

  it('完了グループ内の並び替えを全タスク順序として保存する', async () => {
    const tasks = [
      makeTask('task-active', '未完了', 0),
      makeTask('task-done-a', '完了A', 1, 'done'),
      makeTask('task-done-b', '完了B', 2, 'done'),
    ]
    taskRepoMock.getByTopicId.mockResolvedValue({ ok: true, data: tasks })
    taskRepoMock.update.mockResolvedValue({ ok: true, data: tasks[0] })

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)
    expect(await screen.findByText('未完了')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '完了タスク（2）' }))

    await act(async () => {
      await dragMock.onDragEnd?.({
        active: { id: 'task-done-a' },
        over: { id: 'task-done-b' },
      })
    })

    expect(taskRepoMock.update.mock.calls.map(([id, updateData]) => [id, updateData])).toEqual([
      ['task-active', { order: 0 }],
      ['task-done-b', { order: 1 }],
      ['task-done-a', { order: 2 }],
    ])
  })

  it('一部の保存が失敗した場合は全保存の完了後に再取得する', async () => {
    const lastUpdate = deferred<{ ok: true; data: Task }>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    taskRepoMock.getByTopicId.mockResolvedValue({ ok: true, data: TASKS })
    taskRepoMock.update
      .mockResolvedValueOnce({ ok: true, data: TASKS[1] })
      .mockRejectedValueOnce(new Error('保存に失敗'))
      .mockReturnValueOnce(lastUpdate.promise)

    render(<TopicRow topic={TOPIC} canEdit onAddTask={vi.fn()} />)
    expect(await screen.findByText('タスクA')).toBeInTheDocument()

    let dragPromise: Promise<void> | undefined
    act(() => {
      const result = dragMock.onDragEnd?.({
        active: { id: 'task-a' },
        over: { id: 'task-c' },
      })
      dragPromise = Promise.resolve(result).then(() => undefined)
    })

    expect(displayedTaskTitles()).toEqual(['タスクB', 'タスクC', 'タスクA'])
    expect(taskRepoMock.getByTopicId).toHaveBeenCalledTimes(1)

    await act(async () => {
      lastUpdate.resolve({ ok: true, data: TASKS[0] })
      await dragPromise
    })

    await waitFor(() => {
      expect(taskRepoMock.getByTopicId).toHaveBeenCalledTimes(2)
      expect(displayedTaskTitles()).toEqual(['タスクA', 'タスクB', 'タスクC'])
    })
    expect(consoleError).toHaveBeenCalledWith('タスクの並び替えに失敗しました', expect.any(Error))
    consoleError.mockRestore()
  })
})

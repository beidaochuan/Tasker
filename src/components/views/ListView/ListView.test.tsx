import { StrictMode, type ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Task, Topic } from '@/types'
import { resetDataQueries } from '@/hooks/useDataQueries'
import { useAuthStore } from '@/store/authStore'
import { useFilterStore } from '@/store/filterStore'
import { useUIStore } from '@/store/uiStore'
import { ListView } from './ListView'

const { projectRepoMock, tagRepoMock, taskRepoMock, topicRepoMock } = vi.hoisted(() => ({
  projectRepoMock: {
    getAll: vi.fn(),
  },
  tagRepoMock: {
    getAll: vi.fn(),
  },
  taskRepoMock: {
    getByProjectId: vi.fn(),
    getByTopicId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  topicRepoMock: {
    getByProjectId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  projectRepo: projectRepoMock,
  tagRepo: tagRepoMock,
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
}))

vi.mock('@/components/filter/FilterPanel', () => ({
  FilterPanel: () => <div data-testid="filter-panel" />,
}))

vi.mock('@/components/ui/skeleton', () => ({
  ListViewSkeleton: () => <div role="status">リストを読み込み中</div>,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => children,
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
  SortableTaskRow: ({ task }: { task: Task }) => (
    <div data-testid="sortable-task">{task.title}</div>
  ),
}))

const PROJECT: Project = {
  id: 'project-1',
  name: 'プロジェクト1',
  description: '',
  color: '#3b82f6',
  status: 'active',
  isArchived: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const TOPICS: Topic[] = [
  {
    id: 'topic-1',
    projectId: PROJECT.id,
    name: '開発',
    order: 0,
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'topic-2',
    projectId: PROJECT.id,
    name: '運用',
    order: 1,
    createdAt: new Date('2026-01-01'),
  },
]

function makeTask(
  id: string,
  topicId: string,
  title: string,
  order: number,
  status: Task['status'] = 'todo'
): Task {
  return {
    id,
    topicId,
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

const TASKS: Task[] = [
  makeTask('task-active-1', 'topic-1', '開発中', 0),
  makeTask('task-done-1', 'topic-1', '開発完了', 1, 'done'),
  makeTask('task-active-2', 'topic-2', '運用中', 0),
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function renderListView() {
  return render(
    <StrictMode>
      <ListView />
    </StrictMode>
  )
}

function topicHeader(name: string): HTMLButtonElement {
  const button = screen.getByText(name).closest('button')
  if (!(button instanceof HTMLButtonElement))
    throw new Error(`${name} のトピック見出しがありません`)
  return button
}

describe('ListView', () => {
  beforeEach(() => {
    cleanup()
    resetDataQueries()
    projectRepoMock.getAll.mockReset().mockResolvedValue({ ok: true, data: [PROJECT] })
    tagRepoMock.getAll.mockReset().mockResolvedValue({ ok: true, data: [] })
    topicRepoMock.getByProjectId.mockReset().mockResolvedValue({ ok: true, data: TOPICS })
    topicRepoMock.create.mockReset()
    topicRepoMock.update.mockReset()
    topicRepoMock.delete.mockReset()
    taskRepoMock.getByProjectId.mockReset().mockResolvedValue({ ok: true, data: TASKS })
    taskRepoMock.getByTopicId.mockReset()
    taskRepoMock.update.mockReset()
    taskRepoMock.delete.mockReset()
    useFilterStore.getState().resetFilters()
    useUIStore.setState({
      selectedProjectId: PROJECT.id,
      expandedCompletedTopicIds: {},
    })
    useAuthStore.setState({ isAuthenticated: false, isLoginDialogOpen: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('複数トピックでもプロジェクトデータを各1回だけ取得し、全件数とフィルタ後件数を表示する', async () => {
    useFilterStore.getState().setStatuses(['todo'])

    renderListView()

    expect(await screen.findByText('2 トピック / 3 タスク')).toBeInTheDocument()
    expect(topicHeader('開発')).toHaveTextContent('1')
    expect(topicHeader('運用')).toHaveTextContent('1')
    expect(screen.getByText('開発中')).toBeInTheDocument()
    expect(screen.getByText('運用中')).toBeInTheDocument()
    expect(screen.queryByText('開発完了')).toBeNull()

    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(topicRepoMock.getByProjectId).toHaveBeenCalledWith(PROJECT.id)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledWith(PROJECT.id)
    expect(taskRepoMock.getByTopicId).not.toHaveBeenCalled()

    act(() => {
      useFilterStore.getState().setStatuses([])
    })

    expect(topicHeader('開発')).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: '完了タスク（1）' })).toBeInTheDocument()
    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
  })

  it('未認証でもタスクを閲覧でき、編集操作はログイン導線だけを表示する', async () => {
    renderListView()

    expect(await screen.findByText('開発中')).toBeInTheDocument()
    expect(screen.getByText('運用中')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログインして編集' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'トピックを追加' })).toBeNull()
    expect(screen.queryByRole('button', { name: '開発 にタスクを追加' })).toBeNull()
    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
  })

  it('プロジェクトデータの初回取得中はリストのSkeletonを表示する', async () => {
    const topics = deferred<{ ok: true; data: Topic[] }>()
    const tasks = deferred<{ ok: true; data: Task[] }>()
    topicRepoMock.getByProjectId.mockReturnValue(topics.promise)
    taskRepoMock.getByProjectId.mockReturnValue(tasks.promise)

    renderListView()

    expect(screen.getByRole('status')).toHaveTextContent('リストを読み込み中')
    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)

    await act(async () => {
      topics.resolve({ ok: true, data: TOPICS })
      await topics.promise
    })

    expect(await screen.findByText('2 トピック / 0 タスク')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()

    await act(async () => {
      tasks.resolve({ ok: true, data: TASKS })
      await tasks.promise
    })

    expect(await screen.findByText('2 トピック / 3 タスク')).toBeInTheDocument()
  })

  it('プロジェクト未選択時は選択案内を表示し、プロジェクトデータを取得しない', async () => {
    useUIStore.setState({ selectedProjectId: null })

    renderListView()

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('左のサイドバーからプロジェクトを選択してください')).toBeInTheDocument()
    expect(topicRepoMock.getByProjectId).not.toHaveBeenCalled()
    expect(taskRepoMock.getByProjectId).not.toHaveBeenCalled()
    expect(taskRepoMock.getByTopicId).not.toHaveBeenCalled()
  })
})

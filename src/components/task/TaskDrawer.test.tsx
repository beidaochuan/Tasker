import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Subtask, Task, Topic } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { TaskDrawer } from './TaskDrawer'

const { projectRepoMock, taskRepoMock, topicRepoMock, subtaskRepoMock } = vi.hoisted(() => ({
  projectRepoMock: {
    getAll: vi.fn(),
  },
  taskRepoMock: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByTopicId: vi.fn(),
    completeRecurring: vi.fn(),
  },
  topicRepoMock: {
    getByProjectId: vi.fn(),
  },
  subtaskRepoMock: {
    getByTaskId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  projectRepo: projectRepoMock,
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
  subtaskRepo: subtaskRepoMock,
}))

const PROJECTS: Project[] = [
  {
    id: 'project-1',
    name: 'プロジェクト1',
    description: '',
    color: '#22c55e',
    status: 'active',
    isArchived: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  },
  {
    id: 'project-2',
    name: 'プロジェクト2',
    description: '',
    color: '#3b82f6',
    status: 'active',
    isArchived: false,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  },
]

const TOPICS: Record<string, Topic[]> = {
  'project-1': [
    {
      id: 'topic-1',
      projectId: 'project-1',
      name: 'トピック1',
      order: 0,
      createdAt: new Date(2026, 0, 1),
    },
    {
      id: 'topic-1-second',
      projectId: 'project-1',
      name: 'トピック1-2',
      order: 1,
      createdAt: new Date(2026, 0, 1),
    },
  ],
  'project-2': [
    {
      id: 'topic-2',
      projectId: 'project-2',
      name: 'トピック2',
      order: 0,
      createdAt: new Date(2026, 0, 1),
    },
  ],
}

const TASK: Task = {
  id: 'task-1',
  topicId: 'topic-1',
  title: '既存タスク',
  description: '',
  status: 'todo',
  priority: 'medium',
  startDate: null,
  dueDate: null,
  order: 0,
  tags: [],
  repeatRule: null,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
}

const SUBTASK: Subtask = {
  id: 'subtask-1',
  taskId: TASK.id,
  title: '仕様を確認',
  isDone: false,
  order: 0,
  createdAt: new Date(2026, 0, 1),
}

describe('TaskDrawer', () => {
  beforeEach(() => {
    projectRepoMock.getAll.mockReset().mockResolvedValue({ ok: true, data: PROJECTS })
    taskRepoMock.getById.mockReset().mockResolvedValue({ ok: true, data: TASK })
    taskRepoMock.create.mockReset()
    taskRepoMock.update.mockReset().mockResolvedValue({ ok: true, data: TASK })
    taskRepoMock.delete.mockReset()
    taskRepoMock.getByTopicId.mockReset()
    taskRepoMock.completeRecurring.mockReset()
    topicRepoMock.getByProjectId
      .mockReset()
      .mockImplementation((projectId: string) =>
        Promise.resolve({ ok: true, data: TOPICS[projectId] ?? [] })
      )
    subtaskRepoMock.getByTaskId.mockReset().mockResolvedValue({ ok: true, data: [] })
    subtaskRepoMock.create.mockReset()
    subtaskRepoMock.update.mockReset()
    subtaskRepoMock.delete.mockReset()
    useAuthStore.setState({ isAuthenticated: true, isLoginDialogOpen: false })
    useUIStore.setState({
      selectedProjectId: 'project-1',
      selectedTaskId: 'task-1',
      newTaskTopicId: null,
      isTaskDrawerOpen: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('既存タスクの作業リストを読み込む', async () => {
    render(<TaskDrawer />)

    await waitFor(() => {
      expect(subtaskRepoMock.getByTaskId).toHaveBeenCalledWith('task-1')
    })
    expect(screen.getByRole('heading', { name: '作業リスト' })).toBeInTheDocument()
  })

  it('新規作成中にESCを押すと保存せず閉じる', async () => {
    const user = userEvent.setup()
    useUIStore.setState({
      selectedTaskId: null,
      newTaskTopicId: 'topic-1',
      isTaskDrawerOpen: true,
    })

    render(<TaskDrawer />)

    const titleInput = await screen.findByLabelText('タイトル')
    await user.type(titleInput, '保存しないタスク')
    await user.keyboard('{Escape}')

    expect(useUIStore.getState()).toMatchObject({
      isTaskDrawerOpen: false,
      selectedTaskId: null,
      newTaskTopicId: null,
    })
    expect(taskRepoMock.create).not.toHaveBeenCalled()
  })

  it('編集中にESCを押すと更新せず閉じる', async () => {
    const user = userEvent.setup()
    render(<TaskDrawer />)

    const titleInput = await screen.findByDisplayValue('既存タスク')
    await user.type(titleInput, ' 更新')
    await user.keyboard('{Escape}')

    expect(useUIStore.getState().isTaskDrawerOpen).toBe(false)
    expect(taskRepoMock.update).not.toHaveBeenCalled()
  })

  it('日本語IME変換中のESCでは閉じない', async () => {
    render(<TaskDrawer />)

    const titleInput = await screen.findByDisplayValue('既存タスク')
    fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape', isComposing: true })

    expect(useUIStore.getState().isTaskDrawerOpen).toBe(true)
  })

  it('作業タイトル編集中のESCではタスク画面を閉じない', async () => {
    const user = userEvent.setup()
    subtaskRepoMock.getByTaskId.mockResolvedValue({ ok: true, data: [SUBTASK] })
    render(<TaskDrawer />)

    await user.click(await screen.findByRole('button', { name: '「仕様を確認」を編集' }))
    expect(screen.getByLabelText('作業内容')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('作業内容')).not.toBeInTheDocument()
    expect(screen.getByText('仕様を確認')).toBeInTheDocument()
    expect(useUIStore.getState().isTaskDrawerOpen).toBe(true)
  })

  it('既存タスクでもプロジェクトとトピックを変更して保存できる', async () => {
    const user = userEvent.setup()

    render(<TaskDrawer />)

    await waitFor(() => {
      expect(screen.getByLabelText('プロジェクト')).toHaveValue('project-1')
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-1')
    })

    await user.selectOptions(screen.getByLabelText('プロジェクト'), 'project-2')

    await waitFor(() => {
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-2')
    })

    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(taskRepoMock.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ topicId: 'topic-2' })
      )
    })

    expect(useUIStore.getState().isTaskDrawerOpen).toBe(false)
  })

  it('2番目以降のトピックにある既存タスクの所属を保持する', async () => {
    const user = userEvent.setup()
    taskRepoMock.getById.mockResolvedValue({
      ok: true,
      data: { ...TASK, topicId: 'topic-1-second' },
    })

    render(<TaskDrawer />)

    await waitFor(() => {
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-1-second')
    })

    await user.type(screen.getByLabelText('タイトル'), ' 更新')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(taskRepoMock.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ topicId: 'topic-1-second' })
      )
    })
  })

  it('変更先プロジェクトのトピックを読み込むまで保存できない', async () => {
    const user = userEvent.setup()
    let resolveProject2: ((value: { ok: true; data: Topic[] }) => void) | undefined
    const project2Topics = new Promise<{ ok: true; data: Topic[] }>((resolve) => {
      resolveProject2 = resolve
    })
    topicRepoMock.getByProjectId.mockImplementation((projectId: string) => {
      if (projectId === 'project-2') return project2Topics
      return Promise.resolve({ ok: true, data: TOPICS[projectId] ?? [] })
    })

    render(<TaskDrawer />)

    await waitFor(() => {
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-1')
    })
    await user.selectOptions(screen.getByLabelText('プロジェクト'), 'project-2')

    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled()

    await act(async () => {
      resolveProject2?.({ ok: true, data: TOPICS['project-2'] })
    })
    await waitFor(() => {
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-2')
      expect(screen.getByRole('button', { name: '保存する' })).toBeEnabled()
    })
  })

  it('繰り返しタスクを移動と同時に完了しても移動先トピックを引き継ぐ', async () => {
    const user = userEvent.setup()
    taskRepoMock.getById.mockResolvedValue({
      ok: true,
      data: { ...TASK, repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1' },
    })
    taskRepoMock.completeRecurring.mockResolvedValue({
      ok: true,
      data: {
        task: { ...TASK, status: 'done', topicId: 'topic-2' },
        completion: {
          id: 'completion-1',
          taskId: TASK.id,
          completedAt: new Date(2026, 0, 2),
        },
        nextTask: { ...TASK, id: 'task-2', topicId: 'topic-2' },
      },
    })

    render(<TaskDrawer />)

    await waitFor(() => {
      expect(screen.getByLabelText('プロジェクト')).toHaveValue('project-1')
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-1')
    })

    await user.selectOptions(screen.getByLabelText('プロジェクト'), 'project-2')
    await waitFor(() => {
      expect(screen.getByLabelText('トピック')).toHaveValue('topic-2')
    })
    await user.selectOptions(screen.getByLabelText('ステータス'), 'done')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(taskRepoMock.completeRecurring).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ topicId: 'topic-2' })
      )
    })
    expect(taskRepoMock.update).not.toHaveBeenCalled()
  })
})

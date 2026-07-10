import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Task, Topic } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { TaskDrawer } from './TaskDrawer'

const { projectRepoMock, taskRepoMock, topicRepoMock } = vi.hoisted(() => ({
  projectRepoMock: {
    getAll: vi.fn(),
  },
  taskRepoMock: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getByTopicId: vi.fn(),
    completeRecurring: vi.fn(),
  },
  topicRepoMock: {
    getByProjectId: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  projectRepo: projectRepoMock,
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
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

describe('TaskDrawer', () => {
  beforeEach(() => {
    projectRepoMock.getAll.mockReset().mockResolvedValue({ ok: true, data: PROJECTS })
    taskRepoMock.getById.mockReset().mockResolvedValue({ ok: true, data: TASK })
    taskRepoMock.update.mockReset().mockResolvedValue({ ok: true, data: TASK })
    taskRepoMock.delete.mockReset()
    taskRepoMock.getByTopicId.mockReset()
    taskRepoMock.completeRecurring.mockReset()
    topicRepoMock.getByProjectId
      .mockReset()
      .mockImplementation((projectId: string) =>
        Promise.resolve({ ok: true, data: TOPICS[projectId] ?? [] })
      )
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

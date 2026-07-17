import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataQueries } from './useDataQueries'
import { useKanbanData, useProjectData, useTopics } from './useTasks'
import type { Task, Topic } from '@/types'

const { taskRepoMock, topicRepoMock } = vi.hoisted(() => ({
  taskRepoMock: {
    getByProjectId: vi.fn(),
  },
  topicRepoMock: {
    getByProjectId: vi.fn(),
  },
}))

vi.mock('@/repositories', () => ({
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
}))

function makeTask(
  id: string,
  status: Task['status'],
  priority: Task['priority'],
  statusChangedAt: string
): Task {
  return {
    id,
    topicId: 'topic-1',
    title: id,
    description: '',
    status,
    priority,
    dueDate: null,
    startDate: null,
    order: 0,
    tags: [],
    repeatRule: null,
    statusChangedAt: new Date(statusChangedAt),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

const topic: Topic = {
  id: 'topic-1',
  projectId: 'project-1',
  name: 'Topic',
  order: 0,
  createdAt: new Date(),
}

describe('useProjectData', () => {
  beforeEach(() => {
    taskRepoMock.getByProjectId.mockReset()
    topicRepoMock.getByProjectId.mockReset()
    resetDataQueries()
  })

  it('同じプロジェクトの複数consumerでtopicsとtasksの取得を共有する', async () => {
    topicRepoMock.getByProjectId.mockResolvedValue({ ok: true, data: [topic] })
    taskRepoMock.getByProjectId.mockResolvedValue({
      ok: true,
      data: [makeTask('task-1', 'todo', 'medium', '2026-01-01')],
    })

    const { result } = renderHook(() => {
      const projectData = useProjectData('project-1')
      const topics = useTopics('project-1')
      const kanban = useKanbanData('project-1')
      return { projectData, topics, kanban }
    })

    await waitFor(() => expect(result.current.projectData.isLoading).toBe(false))

    expect(result.current.topics).toHaveLength(1)
    expect(result.current.kanban.tasksByStatus.todo).toHaveLength(1)
    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
  })

  it('topicsだけを使うconsumerはproject tasksを取得しない', async () => {
    topicRepoMock.getByProjectId.mockResolvedValue({ ok: true, data: [topic] })

    const { result } = renderHook(() => useTopics('project-1'))

    await waitFor(() => expect(result.current).toHaveLength(1))

    expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    expect(taskRepoMock.getByProjectId).not.toHaveBeenCalled()
  })

  it('プロジェクト切替中に直前のプロジェクトのデータを返さない', async () => {
    let resolveSecondTopics!: (value: { ok: true; data: Topic[] }) => void
    let resolveSecondTasks!: (value: { ok: true; data: Task[] }) => void

    topicRepoMock.getByProjectId
      .mockResolvedValueOnce({ ok: true, data: [topic] })
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecondTopics = resolve)))
    taskRepoMock.getByProjectId
      .mockResolvedValueOnce({ ok: true, data: [makeTask('old', 'todo', 'medium', '2026-01-01')] })
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecondTasks = resolve)))

    const { result, rerender } = renderHook(({ projectId }) => useProjectData(projectId), {
      initialProps: { projectId: 'project-1' },
    })
    await waitFor(() => expect(result.current.tasks?.[0]?.id).toBe('old'))

    rerender({ projectId: 'project-2' })

    expect(result.current).toMatchObject({
      topics: undefined,
      tasks: undefined,
      isLoading: true,
      isTopicsLoading: true,
      isTasksLoading: true,
    })
    resolveSecondTopics({
      ok: true,
      data: [{ ...topic, id: 'topic-2', projectId: 'project-2' }],
    })
    resolveSecondTasks({
      ok: true,
      data: [
        {
          ...makeTask('new', 'todo', 'medium', '2026-01-02'),
          topicId: 'topic-2',
        },
      ],
    })
    await waitFor(() => expect(result.current.tasks?.[0]?.id).toBe('new'))
  })
})

describe('useKanbanData', () => {
  beforeEach(() => {
    taskRepoMock.getByProjectId.mockReset()
    topicRepoMock.getByProjectId.mockReset()
    resetDataQueries()
  })

  it('未着手・進行中は優先度順、完了は状態変更日時の新しい順にする', async () => {
    topicRepoMock.getByProjectId.mockResolvedValue({ ok: true, data: [] })
    taskRepoMock.getByProjectId.mockResolvedValue({
      ok: true,
      data: [
        makeTask('todo-low', 'todo', 'low', '2026-01-04T00:00:00Z'),
        makeTask('todo-urgent', 'todo', 'urgent', '2026-01-01T00:00:00Z'),
        makeTask('progress-medium', 'in_progress', 'medium', '2026-01-04T00:00:00Z'),
        makeTask('progress-high', 'in_progress', 'high', '2026-01-01T00:00:00Z'),
        makeTask('done-old', 'done', 'urgent', '2026-01-02T00:00:00Z'),
        makeTask('done-new', 'done', 'low', '2026-01-03T00:00:00Z'),
      ],
    })

    const { result } = renderHook(() => useKanbanData('project-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.tasksByStatus.todo).toHaveLength(2)
    })

    expect(result.current.tasksByStatus.todo.map((task) => task.id)).toEqual([
      'todo-urgent',
      'todo-low',
    ])
    expect(result.current.tasksByStatus.in_progress.map((task) => task.id)).toEqual([
      'progress-high',
      'progress-medium',
    ])
    expect(result.current.tasksByStatus.done.map((task) => task.id)).toEqual([
      'done-new',
      'done-old',
    ])
  })
})

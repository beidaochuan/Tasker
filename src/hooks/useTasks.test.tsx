import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefreshStore } from './useDataRefresh'
import { useKanbanData } from './useTasks'
import type { Task } from '@/types'

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

describe('useKanbanData', () => {
  beforeEach(() => {
    taskRepoMock.getByProjectId.mockReset()
    topicRepoMock.getByProjectId.mockReset()
    useRefreshStore.setState({ counter: 0 })
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

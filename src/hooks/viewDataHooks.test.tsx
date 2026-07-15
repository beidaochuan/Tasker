import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, Topic } from '@/types'
import { useCalendarTasks } from './useCalendarTasks'
import { useGanttData } from './useGanttData'
import { useRefreshStore } from './useDataRefresh'

const { taskRepoMock, topicRepoMock } = vi.hoisted(() => ({
  taskRepoMock: { getByProjectId: vi.fn() },
  topicRepoMock: { getByProjectId: vi.fn() },
}))

vi.mock('@/repositories', () => ({
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
}))

const topic: Topic = {
  id: 'topic-1',
  projectId: 'project-1',
  name: 'Topic',
  order: 0,
  createdAt: new Date('2026-01-01'),
}

const task: Task = {
  id: 'task-1',
  topicId: topic.id,
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: new Date('2026-01-10'),
  startDate: null,
  order: 0,
  tags: [],
  repeatRule: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

beforeEach(() => {
  taskRepoMock.getByProjectId.mockReset()
  topicRepoMock.getByProjectId.mockReset()
  useRefreshStore.setState({ counter: 0 })
})

describe('プロジェクト別ビューのデータ取得', () => {
  it('ガントは切替中に前のプロジェクトの行を返さない', async () => {
    topicRepoMock.getByProjectId
      .mockResolvedValueOnce({ ok: true, data: [topic] })
      .mockReturnValueOnce(new Promise(() => {}))
    taskRepoMock.getByProjectId
      .mockResolvedValueOnce({ ok: true, data: [task] })
      .mockReturnValueOnce(new Promise(() => {}))

    const { result, rerender } = renderHook(({ projectId }) => useGanttData(projectId), {
      initialProps: { projectId: 'project-1' },
    })
    await waitFor(() => expect(result.current).toHaveLength(1))

    rerender({ projectId: 'project-2' })

    expect(result.current).toEqual([])
  })

  it('カレンダーは切替中に前のプロジェクトの予定を返さない', async () => {
    taskRepoMock.getByProjectId
      .mockResolvedValueOnce({ ok: true, data: [task] })
      .mockReturnValueOnce(new Promise(() => {}))

    const rangeStart = new Date('2026-01-01')
    const rangeEnd = new Date('2026-02-01')
    const { result, rerender } = renderHook(
      ({ projectId }) => useCalendarTasks(projectId, rangeStart, rangeEnd),
      { initialProps: { projectId: 'project-1' } }
    )
    await waitFor(() => expect(result.current).toHaveLength(1))

    rerender({ projectId: 'project-2' })

    expect(result.current).toEqual([])
  })
})

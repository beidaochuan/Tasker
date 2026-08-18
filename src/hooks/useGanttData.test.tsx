import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataQueries } from './useDataQueries'
import { useGanttData } from './useGanttData'
import type { Task, Topic } from '@/types'
import { testTaskId } from '@/test/taskId'

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

const topic: Topic = {
  id: 'topic-1',
  projectId: 'project-1',
  name: 'Topic',
  order: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

function makeRepeatingTask(): Task {
  return {
    id: testTaskId('repeating'),
    topicId: 'topic-1',
    title: '繰り返しタスク',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: null,
    dueDate: new Date('2020-01-01T00:00:00Z'),
    startDate: null,
    order: 0,
    tags: [],
    repeatRule: 'RRULE:FREQ=DAILY;INTERVAL=1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    subtaskTotal: 3,
    subtaskDone: 1,
  }
}

describe('useGanttData', () => {
  beforeEach(() => {
    taskRepoMock.getByProjectId.mockReset()
    topicRepoMock.getByProjectId.mockReset()
    resetDataQueries()
  })

  it('繰り返しタスクの未来の仮想発生には作業リストの進捗を引き継がない', async () => {
    topicRepoMock.getByProjectId.mockResolvedValue({ ok: true, data: [topic] })
    taskRepoMock.getByProjectId.mockResolvedValue({ ok: true, data: [makeRepeatingTask()] })

    const { result } = renderHook(() => useGanttData('project-1'))

    await waitFor(() => expect(result.current).toHaveLength(1))

    const [virtualTask] = result.current[0].tasks
    expect(virtualTask.isVirtualOccurrence).toBe(true)
    expect(virtualTask.subtaskTotal).toBeUndefined()
    expect(virtualTask.subtaskDone).toBeUndefined()
  })
})

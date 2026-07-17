import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProjectRepository } from '../apiProjectRepository'
import { ApiSubtaskRepository } from '../apiSubtaskRepository'
import { ApiTagRepository } from '../apiTagRepository'
import { ApiTaskCompletionRepository } from '../apiTaskCompletionRepository'
import { ApiTaskRepository } from '../apiTaskRepository'
import { ApiTopicRepository } from '../apiTopicRepository'

const RAW_PROJECT = {
  id: 'project-1',
  name: 'Project',
  description: '',
  color: '#6366f1',
  status: 'active',
  isArchived: 0,
  createdAt: 1_000,
  updatedAt: 1_000,
}

const RAW_TOPIC = {
  id: 'topic-1',
  projectId: 'project-1',
  name: 'Topic',
  order: 0,
  createdAt: 1_000,
}

const RAW_TASK = {
  id: 'task-1',
  topicId: 'topic-1',
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  startDate: null,
  order: 0,
  ganttOrder: null,
  tags: [] as string[],
  repeatRule: null,
  statusChangedAt: 1_000,
  createdAt: 1_000,
  updatedAt: 1_000,
}

function mockFetch(body: unknown, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function expectInvalidResponse(result: { ok: boolean; error?: { code: string } }) {
  expect(result.ok).toBe(false)
  if (result.ok || !result.error) return
  expect(result.error.code).toBe('INVALID_RESPONSE')
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('API repository response boundaries', () => {
  it('一覧内の1件でも壊れたProjectなら部分データを返さない', async () => {
    mockFetch([RAW_PROJECT, { ...RAW_PROJECT, id: 42 }])

    expectInvalidResponse(await new ApiProjectRepository().getAll())
  })

  it('負のTopic順序を拒否する', async () => {
    mockFetch([{ ...RAW_TOPIC, order: -1 }])

    expectInvalidResponse(await new ApiTopicRepository().getByProjectId('project-1'))
  })

  it('一覧内の不正なTaskステータスを拒否する', async () => {
    mockFetch([RAW_TASK, { ...RAW_TASK, id: 'task-2', status: 'cancelled' }])

    expectInvalidResponse(await new ApiTaskRepository().getByProjectId('project-1'))
  })

  it('繰り返し完了payload内の壊れたCompletionを拒否する', async () => {
    mockFetch(
      {
        task: RAW_TASK,
        completion: { id: 'completion-1', taskId: 'task-1', completedAt: 'now' },
        nextTask: null,
      },
      201
    )

    expectInvalidResponse(await new ApiTaskRepository().completeRecurring('task-1', null))
  })

  it('SQLite booleanではないSubtask.isDoneを拒否する', async () => {
    mockFetch([
      {
        id: 'subtask-1',
        taskId: 'task-1',
        title: 'Subtask',
        isDone: 2,
        order: 0,
        createdAt: 1_000,
      },
    ])

    expectInvalidResponse(await new ApiSubtaskRepository().getByTaskId('task-1'))
  })

  it('壊れたTagとCompletionをそれぞれ拒否する', async () => {
    mockFetch([{ id: 'tag-1', name: 'Tag', color: 123 }])
    expectInvalidResponse(await new ApiTagRepository().getAll())

    vi.restoreAllMocks()
    mockFetch([{ id: 'completion-1', taskId: 'task-1', completedAt: null }])
    expectInvalidResponse(await new ApiTaskCompletionRepository().getByTaskId('task-1'))
  })
})

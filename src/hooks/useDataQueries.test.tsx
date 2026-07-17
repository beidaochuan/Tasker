import { StrictMode, type ReactNode } from 'react'
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Tag, Task, Topic } from '@/types'
import {
  resetDataQueries,
  useDataQueryStore,
  useProjectQuery,
  useProjectsQuery,
  useTagsQuery,
} from './useDataQueries'

const { projectRepoMock, tagRepoMock, taskRepoMock, topicRepoMock } = vi.hoisted(() => ({
  projectRepoMock: { getAll: vi.fn() },
  tagRepoMock: { getAll: vi.fn() },
  taskRepoMock: { getByProjectId: vi.fn() },
  topicRepoMock: { getByProjectId: vi.fn() },
}))

vi.mock('@/repositories', () => ({
  projectRepo: projectRepoMock,
  tagRepo: tagRepoMock,
  taskRepo: taskRepoMock,
  topicRepo: topicRepoMock,
}))

function makeProject(id: string): Project {
  return {
    id,
    name: id,
    description: '',
    color: '#3b82f6',
    status: 'active',
    isArchived: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

function makeTopic(projectId: string, suffix = 'topic'): Topic {
  return {
    id: `${projectId}-${suffix}`,
    projectId,
    name: suffix,
    order: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
}

function makeTask(projectId: string, suffix = 'task'): Task {
  return {
    id: `${projectId}-${suffix}`,
    topicId: `${projectId}-topic`,
    title: suffix,
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    startDate: null,
    order: 0,
    ganttOrder: null,
    tags: [],
    repeatRule: null,
    statusChangedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function StrictWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>
}

function ProjectConsumer({ projectId }: { projectId: string }) {
  useProjectQuery(projectId)
  return null
}

function SharedGlobalConsumer() {
  useProjectsQuery()
  useTagsQuery()
  return null
}

function projectCallCount(mock: ReturnType<typeof vi.fn>, projectId: string): number {
  return mock.mock.calls.filter(([calledProjectId]) => calledProjectId === projectId).length
}

describe('useDataQueries', () => {
  beforeEach(() => {
    resetDataQueries()
    projectRepoMock.getAll.mockReset().mockResolvedValue({
      ok: true,
      data: [makeProject('project-a'), makeProject('project-b')],
    })
    tagRepoMock.getAll.mockReset().mockResolvedValue({
      ok: true,
      data: [{ id: 'tag-1', name: 'Tag', color: '#ef4444' } satisfies Tag],
    })
    topicRepoMock.getByProjectId.mockReset().mockImplementation(async (projectId: string) => ({
      ok: true,
      data: [makeTopic(projectId)],
    }))
    taskRepoMock.getByProjectId.mockReset().mockImplementation(async (projectId: string) => ({
      ok: true,
      data: [makeTask(projectId)],
    }))
  })

  afterEach(() => {
    cleanup()
  })

  it('同一projectの複数consumerとStrictModeの再実行でもin-flight requestを共有する', async () => {
    const topicsRequest = deferred<{ ok: true; data: Topic[] }>()
    const tasksRequest = deferred<{ ok: true; data: Task[] }>()
    topicRepoMock.getByProjectId.mockReturnValueOnce(topicsRequest.promise)
    taskRepoMock.getByProjectId.mockReturnValueOnce(tasksRequest.promise)

    render(
      <StrictMode>
        <ProjectConsumer projectId="project-a" />
        <ProjectConsumer projectId="project-a" />
      </StrictMode>
    )

    await waitFor(() => {
      expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
      expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    })
    expect(useDataQueryStore.getState().projectsById['project-a']?.topics.status).toBe('loading')
    expect(useDataQueryStore.getState().projectsById['project-a']?.tasks.status).toBe('loading')

    await act(async () => {
      topicsRequest.resolve({ ok: true, data: [makeTopic('project-a')] })
      tasksRequest.resolve({ ok: true, data: [makeTask('project-a')] })
      await Promise.all([topicsRequest.promise, tasksRequest.promise])
    })

    await waitFor(() => {
      expect(useDataQueryStore.getState().projectsById['project-a']?.topics.status).toBe('success')
      expect(useDataQueryStore.getState().projectsById['project-a']?.tasks.status).toBe('success')
    })
    expect(useDataQueryStore.getState().projectsById['project-a']?.tasks.data?.[0]?.id).toBe(
      'project-a-task'
    )
  })

  it('project Aのresource invalidationはもう一方とproject B・projects・tagsを再取得しない', async () => {
    const { result } = renderHook(
      () => ({
        projectA: useProjectQuery('project-a'),
        projectB: useProjectQuery('project-b'),
        projects: useProjectsQuery(),
        tags: useTagsQuery(),
      }),
      { wrapper: StrictWrapper }
    )

    await waitFor(() => {
      expect(result.current.projectA?.status).toBe('success')
      expect(result.current.projectB?.status).toBe('success')
      expect(result.current.projects.status).toBe('success')
      expect(result.current.tags.status).toBe('success')
    })

    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-a')).toBe(1)
    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-a')).toBe(1)
    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectRepoMock.getAll).toHaveBeenCalledTimes(1)
    expect(tagRepoMock.getAll).toHaveBeenCalledTimes(1)

    act(() => {
      useDataQueryStore.getState().invalidateProjectTasks('project-a')
    })

    await waitFor(() => {
      expect(projectCallCount(taskRepoMock.getByProjectId, 'project-a')).toBe(2)
      expect(result.current.projectA?.status).toBe('success')
    })

    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-a')).toBe(1)
    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectRepoMock.getAll).toHaveBeenCalledTimes(1)
    expect(tagRepoMock.getAll).toHaveBeenCalledTimes(1)

    act(() => {
      useDataQueryStore.getState().invalidateProjectTopics('project-a')
    })

    await waitFor(() => {
      expect(projectCallCount(topicRepoMock.getByProjectId, 'project-a')).toBe(2)
      expect(result.current.projectA?.status).toBe('success')
    })

    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-a')).toBe(2)
    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectRepoMock.getAll).toHaveBeenCalledTimes(1)
    expect(tagRepoMock.getAll).toHaveBeenCalledTimes(1)
  })

  it('invalidated後に旧世代のresponseが到着しても新世代のdataを上書きしない', async () => {
    const oldTopicsRequest = deferred<{ ok: true; data: Topic[] }>()
    const oldTasksRequest = deferred<{ ok: true; data: Task[] }>()
    const newTopicsRequest = deferred<{ ok: true; data: Topic[] }>()
    const newTasksRequest = deferred<{ ok: true; data: Task[] }>()
    topicRepoMock.getByProjectId
      .mockReturnValueOnce(oldTopicsRequest.promise)
      .mockReturnValueOnce(newTopicsRequest.promise)
    taskRepoMock.getByProjectId
      .mockReturnValueOnce(oldTasksRequest.promise)
      .mockReturnValueOnce(newTasksRequest.promise)

    const { result } = renderHook(() => useProjectQuery('project-a'))

    await waitFor(() => {
      expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
      expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useDataQueryStore.getState().invalidateProject('project-a')
    })

    await waitFor(() => {
      expect(topicRepoMock.getByProjectId).toHaveBeenCalledTimes(2)
      expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      newTopicsRequest.resolve({ ok: true, data: [makeTopic('project-a', 'new-topic')] })
      newTasksRequest.resolve({ ok: true, data: [makeTask('project-a', 'new-task')] })
      await Promise.all([newTopicsRequest.promise, newTasksRequest.promise])
    })

    await waitFor(() => {
      expect(result.current?.data?.topics[0]?.id).toBe('project-a-new-topic')
      expect(result.current?.data?.tasks[0]?.id).toBe('project-a-new-task')
    })

    await act(async () => {
      oldTopicsRequest.resolve({ ok: true, data: [makeTopic('project-a', 'old-topic')] })
      oldTasksRequest.resolve({ ok: true, data: [makeTask('project-a', 'old-task')] })
      await Promise.all([oldTopicsRequest.promise, oldTasksRequest.promise])
    })

    expect(result.current?.data?.topics[0]?.id).toBe('project-a-new-topic')
    expect(result.current?.data?.tasks[0]?.id).toBe('project-a-new-task')
  })

  it('tag削除時はそのtagを使うprojectのtasksだけを再取得する', async () => {
    taskRepoMock.getByProjectId.mockImplementation(async (projectId: string) => ({
      ok: true,
      data: [{ ...makeTask(projectId), tags: projectId === 'project-a' ? ['tag-1'] : [] }],
    }))

    const { result } = renderHook(() => ({
      projectA: useProjectQuery('project-a'),
      projectB: useProjectQuery('project-b'),
    }))

    await waitFor(() => {
      expect(result.current.projectA?.status).toBe('success')
      expect(result.current.projectB?.status).toBe('success')
    })

    act(() => {
      useDataQueryStore.getState().invalidateProjectsWithTag('tag-1')
    })

    await waitFor(() => {
      expect(projectCallCount(taskRepoMock.getByProjectId, 'project-a')).toBe(2)
    })
    expect(projectCallCount(taskRepoMock.getByProjectId, 'project-b')).toBe(1)
    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-a')).toBe(1)
    expect(projectCallCount(topicRepoMock.getByProjectId, 'project-b')).toBe(1)
  })

  it('background refresh失敗時は直前のproject dataを保持する', async () => {
    const { result } = renderHook(() => useProjectQuery('project-a'))

    await waitFor(() => expect(result.current?.status).toBe('success'))
    expect(result.current?.data?.tasks[0]?.id).toBe('project-a-task')

    taskRepoMock.getByProjectId.mockRejectedValueOnce(new Error('network error'))
    act(() => {
      useDataQueryStore.getState().invalidateProjectTasks('project-a')
    })

    await waitFor(() => expect(result.current?.status).toBe('error'))
    expect(result.current?.data?.tasks[0]?.id).toBe('project-a-task')
    expect(taskRepoMock.getByProjectId).toHaveBeenCalledTimes(2)

    taskRepoMock.getByProjectId.mockResolvedValueOnce({
      ok: true,
      data: [makeTask('project-a', 'recovered-task')],
    })
    act(() => {
      useDataQueryStore.getState().invalidateProjectTasks('project-a')
    })

    await waitFor(() => expect(result.current?.status).toBe('success'))
    expect(result.current?.data?.tasks[0]?.id).toBe('project-a-recovered-task')
  })

  it('projectsとtagsも複数consumer間でqueryを共有する', async () => {
    const projectsRequest = deferred<{ ok: true; data: Project[] }>()
    const tagsRequest = deferred<{ ok: true; data: Tag[] }>()
    projectRepoMock.getAll.mockReturnValueOnce(projectsRequest.promise)
    tagRepoMock.getAll.mockReturnValueOnce(tagsRequest.promise)

    render(
      <StrictMode>
        <SharedGlobalConsumer />
        <SharedGlobalConsumer />
      </StrictMode>
    )

    await waitFor(() => {
      expect(projectRepoMock.getAll).toHaveBeenCalledTimes(1)
      expect(tagRepoMock.getAll).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      projectsRequest.resolve({ ok: true, data: [makeProject('project-a')] })
      tagsRequest.resolve({
        ok: true,
        data: [{ id: 'tag-1', name: 'Tag', color: '#ef4444' }],
      })
      await Promise.all([projectsRequest.promise, tagsRequest.promise])
    })

    await waitFor(() => {
      expect(useDataQueryStore.getState().projects.status).toBe('success')
      expect(useDataQueryStore.getState().tags.status).toBe('success')
    })
  })
})

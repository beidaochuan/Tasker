import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { projectRepo, tagRepo, taskRepo, topicRepo } from '@/repositories'
import type { Project, Tag, Task, Topic } from '@/types'

type QueryStatus = 'idle' | 'loading' | 'success' | 'error'

interface QueryState<T> {
  data: T | undefined
  status: QueryStatus
  revision: number
}

interface ProjectResources {
  topics: QueryState<Topic[]>
  tasks: QueryState<Task[]>
}

interface ProjectData {
  topics: Topic[]
  tasks: Task[]
}

interface DataQueryState {
  projects: QueryState<Project[]>
  tags: QueryState<Tag[]>
  projectsById: Record<string, ProjectResources>
  loadProjects: () => Promise<void>
  loadTags: () => Promise<void>
  loadProjectTopics: (projectId: string) => Promise<void>
  loadProjectTasks: (projectId: string) => Promise<void>
  invalidateProjects: () => void
  invalidateTags: () => void
  invalidateProjectTopics: (projectId: string) => void
  invalidateProjectTasks: (projectId: string) => void
  invalidateProject: (projectId: string) => void
  updateProjectTask: (projectId: string, task: Task) => void
  removeProject: (projectId: string) => void
  invalidateProjectsWithTag: (tagId: string) => void
  invalidateAllProjects: () => void
  invalidateAll: () => void
}

function idleQuery<T>(): QueryState<T> {
  return { data: undefined, status: 'idle', revision: 0 }
}

function idleProjectResources(): ProjectResources {
  return { topics: idleQuery(), tasks: idleQuery() }
}

function invalidateQuery<T>(query: QueryState<T> | undefined): QueryState<T> {
  return {
    data: query?.data,
    status: 'idle',
    revision: (query?.revision ?? 0) + 1,
  }
}

export const useDataQueryStore = create<DataQueryState>((set, get) => ({
  projects: idleQuery(),
  tags: idleQuery(),
  projectsById: {},

  async loadProjects() {
    const query = get().projects
    if (query.status !== 'idle') return
    const revision = query.revision
    set({ projects: { ...query, status: 'loading' } })

    let data = query.data ?? []
    let status: QueryStatus = 'error'
    try {
      const result = await projectRepo.getAll()
      if (result.ok) {
        data = result.data
        status = 'success'
      }
    } catch {
      // Keep the last successful data when a background refresh fails.
    }

    const current = get().projects
    if (current.revision !== revision) return
    set({ projects: { data, status, revision } })
  },

  async loadTags() {
    const query = get().tags
    if (query.status !== 'idle') return
    const revision = query.revision
    set({ tags: { ...query, status: 'loading' } })

    let data = query.data ?? []
    let status: QueryStatus = 'error'
    try {
      const result = await tagRepo.getAll()
      if (result.ok) {
        data = result.data
        status = 'success'
      }
    } catch {
      // Keep the last successful data when a background refresh fails.
    }

    const current = get().tags
    if (current.revision !== revision) return
    set({ tags: { data, status, revision } })
  },

  async loadProjectTopics(projectId) {
    const resources = get().projectsById[projectId] ?? idleProjectResources()
    if (resources.topics.status !== 'idle') return
    const revision = resources.topics.revision
    set((state) => {
      const current = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...current, topics: { ...resources.topics, status: 'loading' } },
        },
      }
    })

    let data = resources.topics.data ?? []
    let status: QueryStatus = 'error'
    try {
      const result = await topicRepo.getByProjectId(projectId)
      if (result.ok) {
        data = result.data
        status = 'success'
      }
    } catch {
      // Keep the last successful data when a background refresh fails.
    }

    const current = get().projectsById[projectId]?.topics
    if (!current || current.revision !== revision) return
    set((state) => {
      const project = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...project, topics: { data, status, revision } },
        },
      }
    })
  },

  async loadProjectTasks(projectId) {
    const resources = get().projectsById[projectId] ?? idleProjectResources()
    if (resources.tasks.status !== 'idle') return
    const revision = resources.tasks.revision
    set((state) => {
      const current = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...current, tasks: { ...resources.tasks, status: 'loading' } },
        },
      }
    })

    let data = resources.tasks.data ?? []
    let status: QueryStatus = 'error'
    try {
      const result = await taskRepo.getByProjectId(projectId)
      if (result.ok) {
        data = result.data
        status = 'success'
      }
    } catch {
      // Keep the last successful data when a background refresh fails.
    }

    const current = get().projectsById[projectId]?.tasks
    if (!current || current.revision !== revision) return
    set((state) => {
      const project = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...project, tasks: { data, status, revision } },
        },
      }
    })
  },

  invalidateProjects() {
    set((state) => ({ projects: invalidateQuery(state.projects) }))
  },

  invalidateTags() {
    set((state) => ({ tags: invalidateQuery(state.tags) }))
  },

  invalidateProjectTopics(projectId) {
    set((state) => {
      const current = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...current, topics: invalidateQuery(current.topics) },
        },
      }
    })
  },

  invalidateProjectTasks(projectId) {
    set((state) => {
      const current = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: { ...current, tasks: invalidateQuery(current.tasks) },
        },
      }
    })
  },

  invalidateProject(projectId) {
    set((state) => {
      const current = state.projectsById[projectId] ?? idleProjectResources()
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: {
            topics: invalidateQuery(current.topics),
            tasks: invalidateQuery(current.tasks),
          },
        },
      }
    })
  },

  updateProjectTask(projectId, task) {
    set((state) => {
      const current = state.projectsById[projectId]
      const tasks = current?.tasks.data
      if (!current || !tasks?.some((item) => item.id === task.id)) return state
      return {
        projectsById: {
          ...state.projectsById,
          [projectId]: {
            ...current,
            tasks: {
              ...current.tasks,
              data: tasks.map((item) => (item.id === task.id ? task : item)),
            },
          },
        },
      }
    })
  },

  removeProject(projectId) {
    set((state) => {
      const projectsById = { ...state.projectsById }
      delete projectsById[projectId]
      return { projectsById }
    })
  },

  invalidateProjectsWithTag(tagId) {
    set((state) => ({
      projectsById: Object.fromEntries(
        Object.entries(state.projectsById).map(([projectId, resources]) => {
          const usesTag = resources.tasks.data?.some((task) => task.tags.includes(tagId)) ?? false
          const mightContainStaleTag = resources.tasks.status === 'loading'
          return [
            projectId,
            usesTag || mightContainStaleTag
              ? { ...resources, tasks: invalidateQuery(resources.tasks) }
              : resources,
          ]
        })
      ),
    }))
  },

  invalidateAllProjects() {
    set((state) => ({
      projectsById: Object.fromEntries(
        Object.entries(state.projectsById).map(([projectId, resources]) => [
          projectId,
          {
            topics: invalidateQuery(resources.topics),
            tasks: invalidateQuery(resources.tasks),
          },
        ])
      ),
    }))
  },

  invalidateAll() {
    set((state) => ({
      projects: invalidateQuery(state.projects),
      tags: invalidateQuery(state.tags),
      projectsById: Object.fromEntries(
        Object.entries(state.projectsById).map(([projectId, resources]) => [
          projectId,
          {
            topics: invalidateQuery(resources.topics),
            tasks: invalidateQuery(resources.tasks),
          },
        ])
      ),
    }))
  },
}))

export function useProjectsQuery(): QueryState<Project[]> {
  const query = useDataQueryStore((state) => state.projects)
  const loadProjects = useDataQueryStore((state) => state.loadProjects)

  useEffect(() => {
    if (query.status === 'idle') void loadProjects()
  }, [loadProjects, query.status])

  return query
}

export function useTagsQuery(): QueryState<Tag[]> {
  const query = useDataQueryStore((state) => state.tags)
  const loadTags = useDataQueryStore((state) => state.loadTags)

  useEffect(() => {
    if (query.status === 'idle') void loadTags()
  }, [loadTags, query.status])

  return query
}

export function useProjectTopicsQuery(projectId: string | null): QueryState<Topic[]> | undefined {
  const query = useDataQueryStore((state) =>
    projectId ? state.projectsById[projectId]?.topics : undefined
  )
  const loadProjectTopics = useDataQueryStore((state) => state.loadProjectTopics)
  const status = query?.status ?? 'idle'

  useEffect(() => {
    if (projectId && status === 'idle') void loadProjectTopics(projectId)
  }, [loadProjectTopics, projectId, status])

  return query
}

export function useProjectTasksQuery(projectId: string | null): QueryState<Task[]> | undefined {
  const query = useDataQueryStore((state) =>
    projectId ? state.projectsById[projectId]?.tasks : undefined
  )
  const loadProjectTasks = useDataQueryStore((state) => state.loadProjectTasks)
  const status = query?.status ?? 'idle'

  useEffect(() => {
    if (projectId && status === 'idle') void loadProjectTasks(projectId)
  }, [loadProjectTasks, projectId, status])

  return query
}

export function useProjectQuery(projectId: string | null): QueryState<ProjectData> | undefined {
  const topics = useProjectTopicsQuery(projectId)
  const tasks = useProjectTasksQuery(projectId)

  return useMemo(() => {
    if (!projectId || !topics || !tasks) return undefined
    const status: QueryStatus =
      topics.status === 'success' && tasks.status === 'success'
        ? 'success'
        : topics.status === 'error' || tasks.status === 'error'
          ? 'error'
          : topics.status === 'loading' || tasks.status === 'loading'
            ? 'loading'
            : 'idle'
    return {
      data:
        topics.data !== undefined && tasks.data !== undefined
          ? { topics: topics.data, tasks: tasks.data }
          : undefined,
      status,
      revision: topics.revision + tasks.revision,
    }
  }, [projectId, tasks, topics])
}

export function resetDataQueries(): void {
  useDataQueryStore.setState({
    projects: idleQuery(),
    tags: idleQuery(),
    projectsById: {},
  })
}

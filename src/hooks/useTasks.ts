import { useMemo } from 'react'
import type { Task, Topic, TaskStatus } from '@/types'
import { sortByOrder, sortKanbanColumnTasks } from '@/utils/sortUtils'
import { useProjectTasksQuery, useProjectTopicsQuery } from './useDataQueries'

export interface ProjectDataWithLoading {
  topics: Topic[] | undefined
  tasks: Task[] | undefined
  isLoading: boolean
  isTopicsLoading: boolean
  isTasksLoading: boolean
}

export function useTopics(projectId: string | null): Topic[] | undefined {
  const query = useProjectTopicsQuery(projectId)
  const rawTopics = query?.data
  return useMemo(() => {
    if (!projectId) return []
    return rawTopics ? sortByOrder(rawTopics) : undefined
  }, [projectId, rawTopics])
}

export function useProjectTasks(projectId: string | null): Task[] | undefined {
  const query = useProjectTasksQuery(projectId)
  const rawTasks = query?.data
  return useMemo(() => {
    if (!projectId) return []
    return rawTasks ? sortByOrder(rawTasks) : undefined
  }, [projectId, rawTasks])
}

export function useProjectData(projectId: string | null): ProjectDataWithLoading {
  const topics = useTopics(projectId)
  const tasks = useProjectTasks(projectId)
  const isTopicsLoading = projectId !== null && topics === undefined
  const isTasksLoading = projectId !== null && tasks === undefined
  return {
    topics,
    tasks,
    isLoading: isTopicsLoading || isTasksLoading,
    isTopicsLoading,
    isTasksLoading,
  }
}

export function useTask(id: string | null, projectId: string | null): Task | undefined {
  const tasks = useProjectTasks(id ? projectId : null)
  return useMemo(() => tasks?.find((task) => task.id === id), [id, tasks])
}

export interface KanbanData {
  tasksByStatus: Record<TaskStatus, Task[]>
  defaultTopicId: string | null
}

export interface KanbanDataWithLoading extends KanbanData {
  isLoading: boolean
}

export function useKanbanData(projectId: string | null): KanbanDataWithLoading {
  const { topics, tasks, isLoading } = useProjectData(projectId)

  return useMemo(() => {
    const tasksByStatus: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    }
    for (const task of tasks ?? []) {
      tasksByStatus[task.status].push(task)
    }
    for (const status of Object.keys(tasksByStatus) as TaskStatus[]) {
      tasksByStatus[status] = sortKanbanColumnTasks(status, tasksByStatus[status])
    }
    return {
      tasksByStatus,
      defaultTopicId: topics?.[0]?.id ?? null,
      isLoading,
    }
  }, [isLoading, tasks, topics])
}

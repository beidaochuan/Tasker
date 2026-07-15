import { useState, useEffect, useMemo } from 'react'
import type { Task, Topic, TaskStatus } from '@/types'
import { topicRepo, taskRepo } from '@/repositories'
import { sortByOrder, sortKanbanColumnTasks } from '@/utils/sortUtils'
import { useRefreshStore } from './useDataRefresh'

export interface KanbanData {
  tasksByStatus: Record<TaskStatus, Task[]>
  defaultTopicId: string | null
}

export function useTopics(projectId: string | null): Topic[] | undefined {
  const [loaded, setLoaded] = useState<{ projectId: string | null; topics: Topic[] } | null>(null)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      Promise.resolve().then(() => {
        if (!cancelled) setLoaded({ projectId: null, topics: [] })
      })
      return () => {
        cancelled = true
      }
    }
    topicRepo.getByProjectId(projectId).then((r) => {
      if (!cancelled) {
        setLoaded({ projectId, topics: r.ok ? sortByOrder(r.data) : [] })
      }
    })
    return () => {
      cancelled = true
    }
  }, [projectId, counter])

  return loaded?.projectId === projectId ? loaded.topics : undefined
}

export function useTasksByTopic(topicId: string): Task[] {
  const [tasks, setTasks] = useState<Task[]>([])
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    taskRepo.getByTopicId(topicId).then((r) => {
      setTasks(r.ok ? sortByOrder(r.data) : [])
    })
  }, [topicId, counter])

  return tasks
}

export function useTask(id: string | null): Task | undefined {
  const [task, setTask] = useState<Task | undefined>(undefined)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!id) {
      Promise.resolve().then(() => {
        if (!cancelled) setTask(undefined)
      })
      return () => {
        cancelled = true
      }
    }
    taskRepo.getById(id).then((r) => {
      if (!cancelled) setTask(r.ok ? r.data : undefined)
    })
    return () => {
      cancelled = true
    }
  }, [id, counter])

  return task
}

export interface KanbanDataWithLoading extends KanbanData {
  isLoading: boolean
}

export function useKanbanData(projectId: string | null): KanbanDataWithLoading {
  const [data, setData] = useState<{ allTasks: Task[]; defaultTopicId: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const counter = useRefreshStore((s) => s.counter)

  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      Promise.resolve().then(() => {
        if (!cancelled) setData(null)
      })
      return () => {
        cancelled = true
      }
    }
    const promise = Promise.all([
      topicRepo.getByProjectId(projectId),
      taskRepo.getByProjectId(projectId),
    ])
    promise.then(([tr, taskR]) => {
      if (cancelled) return
      setIsLoading(false)
      if (!tr.ok || !taskR.ok) {
        setData(null)
        return
      }
      const defaultTopicId = tr.data[0]?.id ?? null
      const allTasks = sortByOrder(taskR.data)
      setData({ allTasks, defaultTopicId })
    })
    Promise.resolve().then(() => {
      if (!cancelled) setIsLoading(true)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, counter])

  return useMemo(() => {
    const allTasks = data?.allTasks ?? []
    const defaultTopicId = data?.defaultTopicId ?? null
    const tasksByStatus: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    }
    for (const task of allTasks) {
      tasksByStatus[task.status].push(task)
    }
    for (const status of Object.keys(tasksByStatus) as TaskStatus[]) {
      tasksByStatus[status] = sortKanbanColumnTasks(status, tasksByStatus[status])
    }
    return { tasksByStatus, defaultTopicId, isLoading: isLoading && projectId !== null }
  }, [data, isLoading, projectId])
}

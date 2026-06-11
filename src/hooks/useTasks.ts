import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Task, Topic, TaskStatus } from '@/types'
import { rowToTask } from '@/repositories/taskRepository'
import { fromUnixMs } from '@/utils/dateUtils'
import { sortByOrder } from '@/utils/sortUtils'

export interface KanbanData {
  tasksByStatus: Record<TaskStatus, Task[]>
  defaultTopicId: string | null
}

export function useTopics(projectId: string | null): Topic[] | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return []
    const rows = await db.topics.where('projectId').equals(projectId).toArray()
    return sortByOrder(rows.map((r) => ({ ...r, createdAt: fromUnixMs(r.createdAt) })))
  }, [projectId])
}

export function useTasksByTopic(topicId: string): Task[] {
  return (
    useLiveQuery(async () => {
      const rows = await db.tasks.where('topicId').equals(topicId).toArray()
      return sortByOrder(rows.map(rowToTask))
    }, [topicId]) ?? []
  )
}

export function useTask(id: string | null): Task | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const row = await db.tasks.get(id)
    if (!row) return undefined
    return rowToTask(row)
  }, [id])
}

// カンバンビュー用: projectId → topics → tasks を1クエリで取得しステータス別にグループ化
// 依存配列が [projectId]（文字列）のみになり参照不安定性を回避、DBサブスクリプションも1本
export interface KanbanDataWithLoading extends KanbanData {
  isLoading: boolean
}

export function useKanbanData(projectId: string | null): KanbanDataWithLoading {
  const raw = useLiveQuery(async () => {
    if (!projectId) return null
    const topicRows = await db.topics.where('projectId').equals(projectId).toArray()
    const topicIds = topicRows.map((t) => t.id)
    const defaultTopicId = topicIds[0] ?? null
    if (topicIds.length === 0) return { allTasks: [], defaultTopicId }
    const taskRows = await db.tasks.where('topicId').anyOf(topicIds).toArray()
    return { allTasks: sortByOrder(taskRows.map(rowToTask)), defaultTopicId }
  }, [projectId])

  return useMemo(() => {
    const isLoading = raw === undefined && projectId !== null
    const allTasks = raw?.allTasks ?? []
    const defaultTopicId = raw?.defaultTopicId ?? null
    const tasksByStatus: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    }
    for (const task of allTasks) {
      tasksByStatus[task.status].push(task)
    }
    return { tasksByStatus, defaultTopicId, isLoading }
  }, [raw, projectId])
}

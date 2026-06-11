import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Task, Topic } from '@/types'
import { rowToTask } from '@/repositories/taskRepository'
import { fromUnixMs } from '@/utils/dateUtils'
import { sortByOrder } from '@/utils/sortUtils'

export function useTopics(projectId: string | null): Topic[] {
  return (
    useLiveQuery(async () => {
      if (!projectId) return []
      const rows = await db.topics.where('projectId').equals(projectId).toArray()
      return sortByOrder(rows.map((r) => ({ ...r, createdAt: fromUnixMs(r.createdAt) })))
    }, [projectId]) ?? []
  )
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

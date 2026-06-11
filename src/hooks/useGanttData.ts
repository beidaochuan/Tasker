import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { rowToTask } from '@/repositories/taskRepository'
import { fromUnixMs } from '@/utils/dateUtils'
import { sortByOrder } from '@/utils/sortUtils'
import type { Task, Topic } from '@/types'

export interface GanttRow {
  topic: Topic
  tasks: Task[]
}

interface RawGanttData {
  topics: Topic[]
  tasksByTopic: Record<string, Task[]>
}

export function useGanttData(projectId: string | null): GanttRow[] {
  // #9: 型パラメータを明示して RawGanttData | null の型推論を確定させる
  const raw = useLiveQuery<RawGanttData | null>(async () => {
    if (!projectId) return null
    const topicRows = await db.topics.where('projectId').equals(projectId).toArray()
    const topics: Topic[] = sortByOrder(
      topicRows.map((r) => ({ ...r, createdAt: fromUnixMs(r.createdAt) }))
    )
    const topicIds = topics.map((t) => t.id)
    if (topicIds.length === 0) return { topics, tasksByTopic: {} }
    const taskRows = await db.tasks.where('topicId').anyOf(topicIds).toArray()
    const tasksByTopic: Record<string, Task[]> = {}
    for (const row of taskRows) {
      const task = rowToTask(row)
      ;(tasksByTopic[task.topicId] ??= []).push(task)
    }
    for (const tasks of Object.values(tasksByTopic)) {
      tasks.sort((a, b) => a.order - b.order)
    }
    return { topics, tasksByTopic }
  }, [projectId])

  return useMemo(() => {
    if (!raw) return []
    return raw.topics.map((topic) => ({
      topic,
      tasks: raw.tasksByTopic[topic.id] ?? [],
    }))
  }, [raw])
}
